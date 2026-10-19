import "server-only";

import { z } from "zod";

import { safeError } from "@/lib/safe-error";

import { DomainError } from "../../domain/errors";
import { bookAppointmentTool } from "./book-appointment";
import { cancelAppointmentTool } from "./cancel-appointment";
import { checkAvailability } from "./check-availability";
import { createCallbackRequestTool } from "./create-callback-request";
import type { ToolContext, ToolDefinition, ToolResult } from "./define";
import { findAppointments } from "./find-appointments";
import { rescheduleAppointmentTool } from "./reschedule-appointment";

export type { ToolContext, ToolResult } from "./define";

export const tools: ToolDefinition[] = [
  checkAvailability,
  findAppointments,
  bookAppointmentTool,
  cancelAppointmentTool,
  rescheduleAppointmentTool,
  createCallbackRequestTool,
];

const registry = new Map(tools.map((tool) => [tool.name, tool]));

/** JSON Schema for a tool's arguments, in the shape LLM providers expect. */
export function toolParameters(tool: ToolDefinition): Record<string, unknown> {
  const schema = z.toJSONSchema(tool.input) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}

/**
 * Executes a tool call. Never throws: every failure becomes a result the
 * assistant can talk about, so a bad call cannot crash the conversation.
 */
/**
 * VOICE_TOOL_ERROR_HINT, from the 19 Oct eval: after book_appointment
 * returned INVALID_PHONE the assistant still told the caller "Randevunuz
 * oluşturuldu". The error result now says in so many words what did not
 * happen and what to do next.
 */
const NOT_DONE: Record<string, string> = {
  book_appointment:
    'Randevu OLUŞMADI. Hastaya randevunun oluşmadığını açıkça söyle; "oluşturuldu" deme.',
  reschedule_appointment:
    'Randevu DEĞİŞMEDİ. Hastaya randevusunun değişmediğini açıkça söyle; "taşındı" veya "güncellendi" deme.',
  cancel_appointment:
    'Randevu İPTAL EDİLMEDİ. Hastaya randevusunun iptal edilmediğini açıkça söyle; "iptal edildi" deme.',
};

function withErrorHint(name: string, result: ToolResult, on: boolean | undefined): ToolResult {
  const notDone = NOT_DONE[name];
  if (!on || result.ok || !notDone) return result;
  const phone =
    result.error === "INVALID_PHONE"
      ? " Telefon numarası sıfırla başlayan on bir haneden oluşmalı: numarayı yeniden iste, gruplar hâlinde geri oku, hastanın onayını al, sonra tekrar çağır."
      : "";
  return {
    ...result,
    hint: `${notDone} Eksik veya hatalı bilgiyi hastadan yeniden iste; tool'u yalnızca yeni bilgiyle tekrar çağır.${phone}`,
  };
}

export async function runTool(
  name: string,
  rawArgs: unknown,
  ctx: ToolContext,
): Promise<ToolResult> {
  return withErrorHint(name, await runToolOnce(name, rawArgs, ctx), ctx.toolErrorHint);
}

async function runToolOnce(name: string, rawArgs: unknown, ctx: ToolContext): Promise<ToolResult> {
  const tool = registry.get(name);
  if (!tool) {
    return { ok: false, error: "UNKNOWN_TOOL", message: `Bilinmeyen işlem: ${name}` };
  }

  const startedAt = performance.now();
  const log = (fields: Record<string, unknown>) =>
    console.info(
      JSON.stringify({
        msg: "tool.completed",
        tool: name,
        clinicId: ctx.clinic.clinic.id,
        callId: ctx.callId,
        ms: Math.round(performance.now() - startedAt),
        ...fields,
      }),
    );

  const parsed = tool.input.safeParse(parseArgs(rawArgs));
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    log({ ok: false, error: "INVALID_ARGUMENTS" });
    return { ok: false, error: "INVALID_ARGUMENTS", message };
  }

  try {
    const result = await tool.handler(ctx, parsed.data);
    log({ ok: result.ok });
    return result;
  } catch (error) {
    if (error instanceof DomainError) {
      log({ ok: false, error: error.code });
      return { ok: false, error: error.code, message: error.userMessage };
    }
    console.error(
      JSON.stringify({
        msg: "tool.failed",
        tool: name,
        clinicId: ctx.clinic.clinic.id,
        callId: ctx.callId,
        error: safeError(error),
      }),
    );
    return {
      ok: false,
      error: "INTERNAL_ERROR",
      message: "Sistemde kısa bir sorun yaşıyorum. Hastaya geri arama notu bırakmayı öner.",
    };
  }
}

function parseArgs(raw: unknown): unknown {
  if (typeof raw !== "string") return raw ?? {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
