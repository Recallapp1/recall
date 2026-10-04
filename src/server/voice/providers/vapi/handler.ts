import "server-only";

import { normalizePhone } from "@/lib/phone";

import type { Database } from "../../../db";
import {
  findClinicByPhoneNumber,
  loadClinicDirectory,
  type ClinicContext,
} from "../../../domain/clinics";
import { completeCall, upsertCall } from "../../../domain/calls";
import { runTool, type ToolContext } from "../../tools";
import { buildVapiAssistant, type VoicePipelineConfig } from "./assistant";
import { isAuthorizedVapiRequest } from "./auth";
import {
  assistantRequestMessage,
  calledNumber,
  callerNumber,
  endOfCallReportMessage,
  toolCallsMessage,
  vapiPayload,
  type AssistantRequestMessage,
  type EndOfCallReportMessage,
  type ToolCallsMessage,
} from "./schemas";

const PROVIDER = "vapi";

export interface VapiHandlerDeps {
  db: Database;
  secret: string;
  serverUrl: string;
  pipeline: VoicePipelineConfig;
  now: () => Date;
  defer: (task: () => Promise<void>) => void;
}

/** Single entry point for every Vapi server message. Contract: docs/01-architecture/API.md */
export async function handleVapiRequest(
  request: Request,
  deps: VapiHandlerDeps,
): Promise<Response> {
  if (!isAuthorizedVapiRequest(request.headers, deps.secret)) {
    return errorResponse(401, "UNAUTHORIZED", "Invalid webhook secret");
  }

  const body = vapiPayload.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return errorResponse(400, "BAD_REQUEST", "Malformed Vapi payload");
  }

  const raw = body.data.message;
  switch (raw.type) {
    case "assistant-request": {
      const message = assistantRequestMessage.safeParse(raw);
      return message.success
        ? onAssistantRequest(message.data, deps)
        : errorResponse(400, "BAD_REQUEST", "Invalid assistant-request");
    }
    case "tool-calls": {
      const message = toolCallsMessage.safeParse(raw);
      return message.success
        ? onToolCalls(message.data, deps)
        : errorResponse(400, "BAD_REQUEST", "Invalid tool-calls");
    }
    case "end-of-call-report": {
      const message = endOfCallReportMessage.safeParse(raw);
      return message.success
        ? onEndOfCallReport(message.data, deps)
        : errorResponse(400, "BAD_REQUEST", "Invalid end-of-call-report");
    }
    default:
      // status-update, transcript, etc. are informational.
      return Response.json({});
  }
}

async function onAssistantRequest(message: AssistantRequestMessage, deps: VapiHandlerDeps) {
  const ctx = await resolveClinic(message, deps);
  if (!ctx) {
    console.warn(JSON.stringify({ msg: "vapi.clinic_not_found", type: message.type }));
    // Vapi speaks `error` to the caller and ends the call.
    return Response.json({
      error: "Aradığınız numara şu anda hizmet vermiyor. Lütfen daha sonra tekrar deneyin.",
    });
  }

  const now = deps.now();
  const callerPhone = normalizePhone(callerNumber(message));
  const [directory] = await Promise.all([
    loadClinicDirectory(deps.db, ctx.clinic.id),
    message.call?.id
      ? upsertCall(deps.db, {
          clinicId: ctx.clinic.id,
          provider: PROVIDER,
          providerCallId: message.call.id,
          fromNumber: callerPhone,
          toNumber: calledNumber(message),
          startedAt: now,
        })
      : null,
  ]);

  const assistant = buildVapiAssistant({
    clinic: ctx.clinic,
    settings: ctx.settings,
    directory,
    callerPhone,
    now,
    serverUrl: deps.serverUrl,
    serverSecret: deps.secret,
    pipeline: deps.pipeline,
  });
  return Response.json({ assistant });
}

async function onToolCalls(message: ToolCallsMessage, deps: VapiHandlerDeps) {
  const clinic = await resolveClinic(message, deps);
  if (!clinic) return errorResponse(404, "CLINIC_NOT_FOUND", "No clinic for the called number");

  const callerPhone = normalizePhone(callerNumber(message));
  const call = message.call?.id
    ? await upsertCall(deps.db, {
        clinicId: clinic.clinic.id,
        provider: PROVIDER,
        providerCallId: message.call.id,
        fromNumber: callerPhone,
        toNumber: calledNumber(message),
      })
    : null;

  const ctx: ToolContext = {
    db: deps.db,
    clinic,
    callId: call?.id ?? null,
    callerPhone,
    now: deps.now(),
    defer: deps.defer,
  };

  // Sequential on purpose: the model may chain dependent calls in one turn.
  const results = [];
  for (const toolCall of message.toolCallList) {
    const result = await runTool(toolCall.function.name, toolCall.function.arguments, ctx);
    results.push({ toolCallId: toolCall.id, result: JSON.stringify(result) });
  }
  return Response.json({ results });
}

async function onEndOfCallReport(message: EndOfCallReportMessage, deps: VapiHandlerDeps) {
  const clinic = await resolveClinic(message, deps);
  if (!clinic) return errorResponse(404, "CLINIC_NOT_FOUND", "No clinic for the called number");
  if (!message.call?.id) return Response.json({});

  const call = await upsertCall(deps.db, {
    clinicId: clinic.clinic.id,
    provider: PROVIDER,
    providerCallId: message.call.id,
    fromNumber: callerNumber(message),
    toNumber: calledNumber(message),
  });

  await completeCall(deps.db, call, {
    startedAt: message.startedAt ? new Date(message.startedAt) : null,
    endedAt: message.endedAt ? new Date(message.endedAt) : null,
    durationSeconds: message.durationSeconds,
    endedReason: message.endedReason,
    summary: message.analysis?.summary ?? message.summary,
    transcript: message.artifact?.transcript ?? message.transcript,
    recordingUrl: clinic.settings.assistant.recordCalls
      ? (message.artifact?.recordingUrl ?? message.recordingUrl)
      : null,
    costUsd: message.cost,
  });
  return Response.json({});
}

async function resolveClinic(
  message: AssistantRequestMessage | ToolCallsMessage | EndOfCallReportMessage,
  deps: VapiHandlerDeps,
): Promise<ClinicContext | null> {
  const number = normalizePhone(calledNumber(message));
  return number ? findClinicByPhoneNumber(deps.db, number) : null;
}

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}
