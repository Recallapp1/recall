import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";
import { verify } from "retell-sdk";
import type { z } from "zod";

import { normalizePhone } from "@/lib/phone";

import type { Database } from "../../../db";
import { voiceAgents } from "../../../db/schema";
import { completeCall, upsertCall } from "../../../domain/calls";
import {
  findClinicByAgentId,
  findClinicByPhoneNumber,
  loadClinicDirectory,
  type ClinicContext,
} from "../../../domain/clinics";
import { consumeRateLimit, hashKey } from "../../../domain/rate-limit";
import { admitInboundCall } from "../../../domain/voice-limits";
import { allow } from "../../../security/rate-limits";
import { buildCallVariables } from "../../prompt";
import { runTool } from "../../tools";
import { RETELL_PROVIDER } from "./config";
import { callEvent, functionCall, inboundWebhook, type RetellCall } from "./schemas";

export interface RetellHandlerDeps {
  db: Database;
  apiKey: string;
  now: () => Date;
  defer: (task: () => Promise<void>) => void;
  smsDelivers: boolean;
  /** Dispatches one clinic's queued messages (locks, opt-out, window, caps). */
  dispatchClinic: (clinicId: string) => Promise<void>;
  /** Removes the call (audio included) from the provider. */
  deleteProviderCall: (providerCallId: string) => Promise<void>;
}

/**
 * `call_inbound`: maps the dialled number to its clinic, pins the call to the
 * clinic's synced agent and hands over call-time variables. Retell waits up to
 * 10 s for this, so it stays small: a few indexed reads, no external calls.
 */
export async function handleInbound(request: Request, deps: RetellHandlerDeps) {
  const parsed = await readVerified(request, deps.apiKey, inboundWebhook);
  if (!parsed.ok) return parsed.response;
  const inbound = parsed.data.call_inbound;

  const number = normalizePhone(inbound.to_number);
  const ctx = number ? await findClinicByPhoneNumber(deps.db, number) : null;
  if (!ctx) {
    log("warn", "retell.inbound.clinic_not_found");
    return Response.json({ call_inbound: { reject: true } });
  }

  const [agent] = await deps.db
    .select()
    .from(voiceAgents)
    .where(
      and(
        eq(voiceAgents.clinicId, ctx.clinic.id),
        eq(voiceAgents.provider, RETELL_PROVIDER),
        isNotNull(voiceAgents.externalAgentId),
      ),
    );
  if (!agent?.externalAgentId) {
    log("error", "retell.inbound.agent_not_synced", { clinicId: ctx.clinic.id });
    return Response.json({ call_inbound: { reject: true } });
  }

  // Every minute is billed: callers and the clinic's day have limits (audit P-08).
  const now = deps.now();
  const callerPhone = normalizePhone(inbound.from_number);
  const admission = await admitInboundCall(deps.db, ctx, callerPhone, now);
  if (!admission.admitted) {
    log("warn", "retell.inbound.limited", { clinicId: ctx.clinic.id, reason: admission.reason });
    return Response.json({ call_inbound: { reject: true } });
  }

  const [directory] = await Promise.all([
    loadClinicDirectory(deps.db, ctx.clinic.id),
    inbound.call_id
      ? upsertCall(deps.db, {
          clinicId: ctx.clinic.id,
          provider: RETELL_PROVIDER,
          providerCallId: inbound.call_id,
          fromNumber: inbound.from_number,
          toNumber: inbound.to_number,
          startedAt: now,
        })
      : null,
  ]);

  return Response.json({
    call_inbound: {
      override_agent_id: agent.externalAgentId,
      ...(agent.agentVersion != null && { override_agent_version: agent.agentVersion }),
      dynamic_variables: buildCallVariables(ctx.clinic, directory.clinicHours, now, callerPhone),
      metadata: { clinic_id: ctx.clinic.id },
    },
  });
}

/** Custom function call: runs one provider-agnostic tool inside the call's clinic. */
export async function handleFunctionCall(request: Request, deps: RetellHandlerDeps) {
  const parsed = await readVerified(request, deps.apiKey, functionCall);
  if (!parsed.ok) return parsed.response;
  const { name, args, call } = parsed.data;

  const ctx = await resolveClinic(deps.db, call);
  if (!ctx) return errorResponse(404, "CLINIC_NOT_FOUND", "No clinic for this agent");

  // A signature is valid for five minutes (SDK). Within that window a
  // byte-identical request is a replay: it is answered, never executed twice.
  // Retell retries are re-signed, and the mutating tools are idempotent anyway.
  const now = deps.now();
  const signature = request.headers.get("x-retell-signature") ?? "";
  const firstSighting = await consumeRateLimit(
    deps.db,
    `retell-replay:${hashKey(signature)}`,
    REPLAY_WINDOW,
    now,
  );
  if (!firstSighting.allowed) {
    log("warn", "retell.replay_rejected", { clinicId: ctx.clinic.id });
    return Response.json({
      ok: false,
      error: "DUPLICATE_REQUEST",
      message: "Bu istek zaten alındı. Sonucu görmek için find_appointments kullan.",
    });
  }
  if (!(await allow("voiceToolsPerCall", [ctx.clinic.id, call.call_id], { exec: deps.db, now }))) {
    return Response.json({
      ok: false,
      error: "RATE_LIMITED",
      message:
        "Bu görüşmede çok fazla işlem yapıldı. Hastaya klinik ekibinin geri arayacağını söyle ve görüşmeyi nazikçe bitir.",
    });
  }

  const callerPhone = normalizePhone(call.from_number);
  const callRow = await upsertCall(deps.db, {
    clinicId: ctx.clinic.id,
    provider: RETELL_PROVIDER,
    providerCallId: call.call_id,
    fromNumber: callerPhone,
    toNumber: call.to_number,
    startedAt: timestamp(call.start_timestamp),
  });

  const result = await runTool(name, args, {
    db: deps.db,
    clinic: ctx,
    callId: callRow.id,
    callerPhone,
    now: deps.now(),
    defer: deps.defer,
    smsDelivers: deps.smsDelivers,
    sendQueuedMessages: () => deps.defer(() => deps.dispatchClinic(ctx.clinic.id)),
  });
  return Response.json(result);
}

/** Lifecycle events: keeps our call record (duration, transcript, summary, cost) current. */
export async function handleCallEvent(request: Request, deps: RetellHandlerDeps) {
  const parsed = await readVerified(request, deps.apiKey, callEvent);
  if (!parsed.ok) return parsed.response;
  const { event, call } = parsed.data;

  const ctx = await resolveClinic(deps.db, call);
  if (!ctx) {
    // Acknowledge anyway: retrying cannot fix an unknown agent.
    log("warn", "retell.event.clinic_not_found", { event });
    return Response.json({});
  }

  const callRow = await upsertCall(deps.db, {
    clinicId: ctx.clinic.id,
    provider: RETELL_PROVIDER,
    providerCallId: call.call_id,
    fromNumber: call.from_number,
    toNumber: call.to_number,
    startedAt: timestamp(call.start_timestamp),
  });

  if (event === "call_ended" || event === "call_analyzed") {
    const combinedCostCents = call.call_cost?.combined_cost;
    await completeCall(deps.db, callRow, {
      startedAt: timestamp(call.start_timestamp),
      endedAt: timestamp(call.end_timestamp),
      durationSeconds: call.duration_ms != null ? call.duration_ms / 1000 : null,
      endedReason: call.disconnection_reason,
      transcript: call.transcript,
      recordingUrl: ctx.settings.assistant.recordCalls ? call.recording_url : null,
      summary: call.call_analysis?.call_summary,
      costUsd: combinedCostCents != null ? combinedCostCents / 100 : null,
    });
  }

  // Recording off: Retell has no audio-only switch, and storing nothing also
  // strips the webhook (no transcript or summary). So the call is deleted on
  // Retell once its last event (the analysis) has reached us.
  if (event === "call_analyzed" && !ctx.settings.assistant.recordCalls) {
    deps.defer(async () => {
      try {
        await deps.deleteProviderCall(call.call_id);
      } catch (error) {
        log("error", "retell.call_delete_failed", {
          clinicId: ctx.clinic.id,
          error: String(error),
        });
      }
    });
  }
  return Response.json({});
}

/**
 * The tenant comes from the agent that handled the call — never from model
 * output. When the inbound webhook also stamped a clinic id, both must agree.
 */
async function resolveClinic(db: Database, call: RetellCall): Promise<ClinicContext | null> {
  const ctx = await findClinicByAgentId(db, RETELL_PROVIDER, call.agent_id);
  const stamped = call.metadata?.clinic_id;
  if (ctx && typeof stamped === "string" && stamped !== ctx.clinic.id) {
    log("error", "retell.tenant_mismatch", { clinicId: ctx.clinic.id });
    return null;
  }
  return ctx;
}

/** Signatures expire after five minutes; remembering them twice as long covers clock skew. */
const REPLAY_WINDOW = { limit: 1, windowMs: 10 * 60 * 1000 };

type Verified<T> = { ok: true; data: T } | { ok: false; response: Response };

/** Verifies `X-Retell-Signature` against the raw body, then parses it. */
async function readVerified<S extends z.ZodType>(
  request: Request,
  apiKey: string,
  schema: S,
): Promise<Verified<z.infer<S>>> {
  const raw = await request.text();
  const signature = request.headers.get("x-retell-signature");
  if (!signature || !(await verify(raw, apiKey, signature))) {
    return { ok: false, response: errorResponse(401, "UNAUTHORIZED", "Invalid signature") };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, response: errorResponse(400, "BAD_REQUEST", "Body is not JSON") };
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    // Shape only (key names and failing paths), never values: payloads carry patient data.
    log("warn", "retell.payload_rejected", {
      keys: json && typeof json === "object" ? Object.keys(json) : typeof json,
      paths: result.error.issues.map((issue) => issue.path.join(".")),
    });
    return { ok: false, response: errorResponse(400, "BAD_REQUEST", "Unexpected payload") };
  }
  return { ok: true, data: result.data };
}

function timestamp(ms: number | null | undefined): Date | null {
  return ms != null ? new Date(ms) : null;
}

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

function log(level: "warn" | "error", msg: string, fields: Record<string, unknown> = {}) {
  console[level](JSON.stringify({ msg, ...fields }));
}
