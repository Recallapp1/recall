import "server-only";

import { createHash } from "node:crypto";

import { and, eq, lt, sql } from "drizzle-orm";

import type { Executor } from "../db";
import { toolRequests } from "../db/schema";

/** Tools that change data; the rest are read-only and safe to repeat. */
export const MUTATING_TOOLS: ReadonlySet<string> = new Set([
  "book_appointment",
  "cancel_appointment",
  "reschedule_appointment",
  "create_callback_request",
]);

/** A request still running after this long is treated as abandoned and may run again. */
export const STALE_PENDING_MS = 60_000;

export interface ToolRequestIdentity {
  clinicId: string;
  /** Our `calls.id`. */
  callId: string;
  tool: string;
  /** Provider tool call id when known, else derived from the tool and its arguments. */
  requestKey: string;
}

/** Key from the provider's tool call id, or from the tool name and canonical arguments. */
export function requestKey(tool: string, args: unknown, providerToolCallId: string | null): string {
  if (providerToolCallId) return `tc:${providerToolCallId}`;
  return `args:${tool}:${createHash("sha256").update(canonical(args)).digest("hex").slice(0, 32)}`;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export type IdempotentOutcome<T> =
  { kind: "ran"; result: T } | { kind: "replayed"; result: T } | { kind: "in_progress" };

/**
 * Runs a mutating tool once per request key (audit A3). The claim is an atomic
 * insert: of two simultaneous identical requests only one runs, the other
 * answers "in progress", and any later repeat gets the stored first result
 * (so no second booking, cancellation or SMS). A failed run releases the claim
 * so the request can be tried again.
 */
export async function runOnce<T extends Record<string, unknown>>(
  exec: Executor,
  identity: ToolRequestIdentity,
  now: Date,
  run: () => Promise<T>,
): Promise<IdempotentOutcome<T>> {
  const claimed = await exec
    .insert(toolRequests)
    .values({ ...identity, status: "pending", createdAt: now, updatedAt: now })
    .onConflictDoNothing()
    .returning({ callId: toolRequests.callId });

  if (claimed.length === 0) {
    const [existing] = await exec
      .select()
      .from(toolRequests)
      .where(
        and(
          eq(toolRequests.callId, identity.callId),
          eq(toolRequests.requestKey, identity.requestKey),
        ),
      );
    if (existing?.status === "done" && existing.result) {
      return { kind: "replayed", result: existing.result as T };
    }
    // Take over a claim whose runner never finished (crash, timeout).
    const takenOver = await exec
      .update(toolRequests)
      .set({ updatedAt: now })
      .where(
        and(
          eq(toolRequests.callId, identity.callId),
          eq(toolRequests.requestKey, identity.requestKey),
          eq(toolRequests.status, "pending"),
          lt(toolRequests.updatedAt, new Date(now.getTime() - STALE_PENDING_MS)),
        ),
      )
      .returning({ callId: toolRequests.callId });
    if (takenOver.length === 0) return { kind: "in_progress" };
  }

  let result: T;
  try {
    result = await run();
  } catch (error) {
    await release(exec, identity);
    throw error;
  }
  // Failed results (ok: false) are not stored: the caller may correct and retry.
  if (result.ok === false) {
    await release(exec, identity);
  } else {
    await exec
      .update(toolRequests)
      .set({ status: "done", result, updatedAt: sql`now()` })
      .where(
        and(
          eq(toolRequests.callId, identity.callId),
          eq(toolRequests.requestKey, identity.requestKey),
        ),
      );
  }
  return { kind: "ran", result };
}

async function release(exec: Executor, identity: ToolRequestIdentity) {
  await exec
    .delete(toolRequests)
    .where(
      and(
        eq(toolRequests.callId, identity.callId),
        eq(toolRequests.requestKey, identity.requestKey),
        eq(toolRequests.status, "pending"),
      ),
    );
}
