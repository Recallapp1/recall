import { z } from "zod";

import type { CallLatency } from "@/lib/contracts/call-latency";

/**
 * Retell request payloads. Lenient on purpose (loose objects, optional
 * fields): we validate what we read and ignore the rest, so additive changes
 * on Retell's side cannot break call handling.
 */

const metadata = z.record(z.string(), z.unknown()).nullish();

/** The `call` object Retell attaches to custom function calls and events. */
export const retellCall = z.looseObject({
  call_id: z.string(),
  agent_id: z.string(),
  agent_version: z.number().nullish(),
  call_type: z.string().nullish(),
  direction: z.string().nullish(),
  from_number: z.string().nullish(),
  to_number: z.string().nullish(),
  metadata,
  start_timestamp: z.number().nullish(),
  end_timestamp: z.number().nullish(),
  duration_ms: z.number().nullish(),
  disconnection_reason: z.string().nullish(),
  transcript: z.string().nullish(),
  recording_url: z.string().nullish(),
  call_analysis: z.looseObject({ call_summary: z.string().nullish() }).nullish(),
  call_cost: z.looseObject({ combined_cost: z.number().nullish() }).nullish(),
  // Read leniently by retellLatency(): an odd shape must not reject the event.
  latency: z.unknown().optional(),
});

const latencyStats = z.looseObject({
  p50: z.number().nullish(),
  p90: z.number().nullish(),
  max: z.number().nullish(),
});

/** Retell's `latency` reduced to p50/p90/max of the components we track; null if absent or unreadable. */
export function retellLatency(raw: unknown): CallLatency | null {
  if (typeof raw !== "object" || raw === null) return null;
  const result: CallLatency = {};
  for (const key of ["e2e", "asr", "llm", "tts"] as const) {
    const parsed = latencyStats.safeParse((raw as Record<string, unknown>)[key]);
    if (!parsed.success) continue;
    const { p50, p90, max } = parsed.data;
    if (p50 == null && p90 == null && max == null) continue;
    result[key] = { p50: p50 ?? null, p90: p90 ?? null, max: max ?? null };
  }
  return Object.keys(result).length > 0 ? result : null;
}

export const inboundWebhook = z.looseObject({
  event: z.literal("call_inbound"),
  call_inbound: z.looseObject({
    call_id: z.string().nullish(),
    agent_id: z.string().nullish(),
    from_number: z.string().nullish(),
    to_number: z.string(),
  }),
});

export const functionCall = z.looseObject({
  name: z.string(),
  call: retellCall,
  args: z.record(z.string(), z.unknown()).default({}),
});

export const callEvent = z.looseObject({
  event: z.string(),
  call: retellCall,
});

export type RetellCall = z.infer<typeof retellCall>;
export type InboundWebhook = z.infer<typeof inboundWebhook>;
export type FunctionCall = z.infer<typeof functionCall>;
export type CallEvent = z.infer<typeof callEvent>;
