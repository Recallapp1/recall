import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";
import { verify } from "retell-sdk";
import type { z } from "zod";

import { safeError } from "@/lib/safe-error";
import { normalizePhone } from "@/lib/phone";

import type { Database } from "../../../db";
import { calls, voiceAgents } from "../../../db/schema";
import { flagCall } from "../../../domain/call-flag-records";
import { completeCall, upsertCall } from "../../../domain/calls";
import {
  findClinicByAgentId,
  findClinicByPhoneNumber,
  loadClinicDirectory,
  type ClinicContext,
} from "../../../domain/clinics";
import { consumeRateLimit, hashKey } from "../../../domain/rate-limit";
import { admitInboundCall } from "../../../domain/voice-limits";
import { MUTATING_TOOLS, requestKey, runOnce } from "../../../domain/tool-requests";
import {
  enqueueProviderDeletions,
  isErasedProviderCall,
  processProviderDeletions,
} from "../../../domain/provider-deletions";
import { raiseAlarm } from "../../../observability/alarm";
import { allow } from "../../../security/rate-limits";
import { buildCallVariables } from "../../prompt";
import { runTool } from "../../tools";
import { RETELL_PROVIDER } from "./config";
import { callEvent, functionCall, inboundWebhook, retellLatency, type RetellCall } from "./schemas";

export interface RetellHandlerDeps {
  db: Database;
  apiKey: string;
  now: () => Date;
  defer: (task: () => Promise<void>) => void;
  smsDelivers: boolean;
  /** POST_CALL_FLAGS: flag finished calls for the panel. Unset means off. */
  postCallFlags?: boolean;
  /** VOICE_SHARED_NUMBER_CHECK. Unset means off. */
  sharedNumberCheck?: boolean;
  /** VOICE_VERIFY_HINT. Unset means off. */
  verifyHint?: boolean;
  /** VOICE_TOOL_IDEMPOTENCY: mutating tools run once per request key. Unset means off. */
  toolIdempotency?: boolean;
  /**
   * VOICE_TOOL_FAILSAFE (gap review G-03): a failure before the tool runs
   * (database down) answers an honest ok: false instead of HTTP 500. Unset means off.
   */
  toolFailsafe?: boolean;
  /** CALL_LATENCY_STORE: keep the provider's per-call latency. Unset means off. */
  storeLatency?: boolean;
  /**
   * UNBACKED_CLAIM_EMAIL: tells the clinic's owners and admins about a call
   * flagged unbacked_claim (needs POST_CALL_FLAGS). Unset means off.
   */
  alertUnbackedClaim?: (clinicId: string, callId: string) => Promise<void>;
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
    // A number routed to Retell but not bound to a clinic: callers are turned away.
    await alarmOncePerDay(
      deps,
      `unknown:${number ?? inbound.to_number}`,
      "voice.inbound_unknown_number",
      {},
    );
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
    await alarmOncePerDay(deps, `unsynced:${ctx.clinic.id}`, "voice.inbound_agent_not_synced", {
      clinicId: ctx.clinic.id,
    });
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

/**
 * Calls refused because of our configuration (full audit FA-11): one alarm per
 * subject and day. The subject is hashed into the counter key; the alarm
 * carries ids only, never a phone number.
 */
async function alarmOncePerDay(
  deps: RetellHandlerDeps,
  subject: string,
  event: string,
  fields: Record<string, string>,
) {
  try {
    const first = await consumeRateLimit(
      deps.db,
      `voice-alarm:inbound:${hashKey(subject)}`,
      { limit: 1, windowMs: 24 * 60 * 60 * 1000 },
      deps.now(),
    );
    if (first.allowed) raiseAlarm(event, fields);
  } catch (error) {
    // The call is refused either way; an unreachable counter still alarms.
    raiseAlarm(event, fields, error);
  }
}

/** Custom function call: runs one provider-agnostic tool inside the call's clinic. */
export async function handleFunctionCall(request: Request, deps: RetellHandlerDeps) {
  const parsed = await readVerified(request, deps.apiKey, functionCall);
  if (!parsed.ok) return parsed.response;
  const signature = request.headers.get("x-retell-signature") ?? "";
  if (!deps.toolFailsafe) return runFunctionCall(parsed.data, signature, deps);
  try {
    return await runFunctionCall(parsed.data, signature, deps);
  } catch (error) {
    log("error", "retell.tool.unavailable", { tool: parsed.data.name, error: safeError(error) });
    return Response.json(TOOL_UNAVAILABLE);
  }
}

/**
 * What the assistant gets when the tool could not even start: never a claim
 * of success, the same honest wording a failing tool returns (tools/index.ts).
 */
export const TOOL_UNAVAILABLE = {
  ok: false,
  error: "INTERNAL_ERROR",
  message: "Sistemde kısa bir sorun yaşıyorum. Hastaya geri arama notu bırakmayı öner.",
} as const;

async function runFunctionCall(
  data: z.infer<typeof functionCall>,
  signature: string,
  deps: RetellHandlerDeps,
) {
  const { name, args, call } = data;

  const ctx = await resolveClinic(deps.db, call);
  if (!ctx) return errorResponse(404, "CLINIC_NOT_FOUND", "No clinic for this agent");

  // A signature is valid for five minutes (SDK). Within that window a
  // byte-identical request is a replay: it is answered, never executed twice.
  // Retell retries are re-signed, and the mutating tools are idempotent anyway.
  const now = deps.now();
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

  const run = () =>
    runTool(name, args, {
      db: deps.db,
      clinic: ctx,
      callId: callRow.id,
      callerPhone,
      now: deps.now(),
      defer: deps.defer,
      smsDelivers: deps.smsDelivers,
      sendQueuedMessages: () => deps.defer(() => deps.dispatchClinic(ctx.clinic.id)),
      sharedNumberCheck: deps.sharedNumberCheck,
      verifyHint: deps.verifyHint,
    });
  if (!deps.toolIdempotency || !MUTATING_TOOLS.has(name)) return Response.json(await run());

  // One run per request (audit A3): a repeat returns the first result.
  const outcome = await runOnce(
    deps.db,
    {
      clinicId: ctx.clinic.id,
      callId: callRow.id,
      tool: name,
      requestKey: requestKey(name, args, providerToolCallId(data, name, args)),
    },
    now,
    run,
  );
  if (outcome.kind === "in_progress") {
    return Response.json({
      ok: false,
      error: "DUPLICATE_REQUEST",
      message:
        "Bu istek şu anda işleniyor. Sonucu görmek için biraz sonra find_appointments kullan.",
    });
  }
  return Response.json(
    outcome.kind === "replayed" ? { ...outcome.result, replayed: true } : outcome.result,
  );
}

/**
 * Retell's tool call id for this request: the latest invocation in the call's
 * transcript with the same tool name and the same arguments. Anything less
 * certain falls back to a key from the tool name and arguments.
 */
function providerToolCallId(
  body: unknown,
  tool: string,
  args: Record<string, unknown>,
): string | null {
  const turns = (body as { call?: { transcript_with_tool_calls?: unknown } }).call
    ?.transcript_with_tool_calls;
  if (!Array.isArray(turns)) return null;
  const wanted = requestKey(tool, args, null);
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const turn = turns[i] as Record<string, unknown>;
    if (turn?.role !== "tool_call_invocation" || turn.name !== tool) continue;
    if (typeof turn.tool_call_id !== "string") continue;
    let invoked: unknown;
    try {
      invoked = typeof turn.arguments === "string" ? JSON.parse(turn.arguments) : turn.arguments;
    } catch {
      continue;
    }
    if (requestKey(tool, invoked, null) === wanted) return turn.tool_call_id;
  }
  return null;
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
  // A call of an erased patient takes no more content, whenever its events arrive.
  if (await isErasedProviderCall(deps.db, ctx.clinic.id, RETELL_PROVIDER, call.call_id)) {
    log("warn", "retell.event.erased_call_ignored", { clinicId: ctx.clinic.id, event });
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
      latency: deps.storeLatency ? retellLatency(call.latency) : null,
    });
  }

  // The analysis is the last event: transcript and summary are final.
  if (event === "call_analyzed" && deps.postCallFlags) {
    const flags = await flagCall(deps.db, ctx.clinic.id, callRow.id, deps.now());
    if (flags.length > 0) log("warn", "call.flagged", { clinicId: ctx.clinic.id, flags });
    // Once per call: a repeated analysis webhook finds the call already checked.
    const alert = deps.alertUnbackedClaim;
    if (alert && callRow.flaggedAt === null && flags.includes("unbacked_claim")) {
      deps.defer(async () => {
        try {
          await alert(ctx.clinic.id, callRow.id);
        } catch (error) {
          log("error", "call.claim_alert_failed", {
            clinicId: ctx.clinic.id,
            error: String(error),
          });
        }
      });
    }
  }

  // Recording off: Retell has no audio-only switch, and storing nothing also
  // strips the webhook (no transcript or summary). So the call is deleted on
  // Retell once its last event (the analysis) has reached us.
  // Queued first, so a failed or skipped attempt is retried by the daily job.
  if (event === "call_analyzed" && !ctx.settings.assistant.recordCalls) {
    // A link stored while recording was still on points at audio deleted below (G-15).
    await deps.db
      .update(calls)
      .set({ recordingUrl: null })
      .where(and(eq(calls.clinicId, ctx.clinic.id), eq(calls.id, callRow.id)));
    const target = [{ provider: RETELL_PROVIDER, providerCallId: call.call_id }];
    await enqueueProviderDeletions(deps.db, ctx.clinic.id, target, "recording_off", deps.now());
    deps.defer(async () => {
      try {
        await processProviderDeletions(
          deps.db,
          (_, id) => deps.deleteProviderCall(id),
          deps.now(),
          {
            providerCallIds: [call.call_id],
          },
        );
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
