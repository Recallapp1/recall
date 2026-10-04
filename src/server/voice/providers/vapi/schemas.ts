import { z } from "zod";

/**
 * Vapi server message payloads. Deliberately lenient (loose objects, optional
 * fields): we validate what we read and ignore the rest, so additive changes
 * on Vapi's side cannot break call handling.
 */

const phoneRef = z.looseObject({ number: z.string().optional() }).nullish();

const call = z
  .looseObject({
    id: z.string(),
    customer: phoneRef,
    phoneNumber: phoneRef,
  })
  .nullish();

const base = {
  call,
  customer: phoneRef,
  phoneNumber: phoneRef,
};

const toolCall = z.looseObject({
  id: z.string(),
  function: z.looseObject({
    name: z.string(),
    // Vapi sends parsed objects; older payloads used JSON strings.
    arguments: z.union([z.record(z.string(), z.unknown()), z.string()]).optional(),
  }),
});

export const assistantRequestMessage = z.looseObject({
  ...base,
  type: z.literal("assistant-request"),
});

export const toolCallsMessage = z.looseObject({
  ...base,
  type: z.literal("tool-calls"),
  toolCallList: z.array(toolCall).default([]),
});

export const endOfCallReportMessage = z.looseObject({
  ...base,
  type: z.literal("end-of-call-report"),
  endedReason: z.string().nullish(),
  startedAt: z.iso.datetime({ offset: true }).nullish(),
  endedAt: z.iso.datetime({ offset: true }).nullish(),
  durationSeconds: z.number().nullish(),
  cost: z.number().nullish(),
  summary: z.string().nullish(),
  transcript: z.string().nullish(),
  recordingUrl: z.string().nullish(),
  analysis: z.looseObject({ summary: z.string().nullish() }).nullish(),
  artifact: z
    .looseObject({
      transcript: z.string().nullish(),
      recordingUrl: z.string().nullish(),
    })
    .nullish(),
});

export const vapiPayload = z.object({
  message: z.looseObject({ type: z.string() }),
});

export type AssistantRequestMessage = z.infer<typeof assistantRequestMessage>;
export type ToolCallsMessage = z.infer<typeof toolCallsMessage>;
export type EndOfCallReportMessage = z.infer<typeof endOfCallReportMessage>;
type AnyCallMessage = AssistantRequestMessage | ToolCallsMessage | EndOfCallReportMessage;

/** The clinic's number that was dialled. */
export function calledNumber(message: AnyCallMessage): string | undefined {
  return message.phoneNumber?.number ?? message.call?.phoneNumber?.number;
}

/** The caller's number, absent when withheld. */
export function callerNumber(message: AnyCallMessage): string | undefined {
  return message.customer?.number ?? message.call?.customer?.number;
}
