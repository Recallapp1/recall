import "server-only";

import type { z } from "zod";

import type { Database } from "../../db";
import type { ClinicContext } from "../../domain/clinics";
import type { DomainErrorCode } from "../../domain/errors";

/**
 * Built on the server from the webhook — never from model output — so a tool
 * can only ever act inside the clinic that was actually called.
 */
export interface ToolContext {
  db: Database;
  clinic: ClinicContext;
  /** Our `calls.id`, when the call has been registered. */
  callId: string | null;
  /** Caller ID in E.164, or null when withheld. */
  callerPhone: string | null;
  now: Date;
  /** Runs work after the response is sent to keep tool latency low. */
  defer: (task: () => Promise<void>) => void;
  /** Whether an SMS actually reaches the patient (false until a real provider is set). */
  smsDelivers: boolean;
  /**
   * Sends the clinic's queued messages after the response. Tools never send
   * SMS themselves: they queue a notification and the dispatcher applies the
   * locks, opt-out, send window and caps.
   */
  sendQueuedMessages: () => void;
}

export type ToolErrorCode =
  DomainErrorCode | "INVALID_ARGUMENTS" | "UNKNOWN_TOOL" | "INTERNAL_ERROR" | "DUPLICATE_REQUEST";

export type ToolResult =
  ({ ok: true } & Record<string, unknown>) | { ok: false; error: ToolErrorCode; message: string };

export interface ToolDefinition<Input extends z.ZodType = z.ZodType> {
  name: string;
  /** Read by the LLM: say when to call the tool, not how it works. */
  description: string;
  input: Input;
  /** Short line the assistant says while the tool runs. */
  fillerMessage?: string;
  // Method syntax keeps tools with specific inputs assignable to ToolDefinition[].
  handler(ctx: ToolContext, input: z.infer<Input>): Promise<ToolResult>;
}

export function defineTool<Input extends z.ZodType>(
  tool: ToolDefinition<Input>,
): ToolDefinition<Input> {
  return tool;
}
