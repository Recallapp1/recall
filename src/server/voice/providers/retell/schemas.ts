import { z } from "zod";

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
});

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
