import "server-only";

import { and, asc, eq, inArray, isNull, lte } from "drizzle-orm";

import type { Executor } from "../db";
import { providerDeletions } from "../db/schema";
import { raiseAlarm } from "../observability/alarm";

export type DeletionReason = "patient_anonymized" | "recording_off";

/** Deletes one call on its provider; "already gone" must resolve, not throw. */
export type DeleteProviderCall = (provider: string, providerCallId: string) => Promise<void>;

/** Retries back off from 15 minutes to a day; the daily job picks up what is due. */
const FIRST_RETRY_MS = 15 * 60 * 1000;
const MAX_RETRY_MS = 24 * 60 * 60 * 1000;
/** From this many failures on, every further failure raises an alarm. */
export const ALARM_AFTER_ATTEMPTS = 3;

/**
 * Queues provider-side deletions (audit P-10). Call it in the same transaction
 * as the erasure: once committed, the deletion cannot be forgotten.
 */
export async function enqueueProviderDeletions(
  exec: Executor,
  clinicId: string,
  items: readonly { provider: string; providerCallId: string }[],
  reason: DeletionReason,
  now: Date,
): Promise<void> {
  if (items.length === 0) return;
  await exec
    .insert(providerDeletions)
    .values(
      items.map((item) => ({
        clinicId,
        provider: item.provider,
        providerCallId: item.providerCallId,
        reason,
        nextAttemptAt: now,
      })),
    )
    .onConflictDoNothing();
}

export interface DeletionRunResult {
  deleted: number;
  failed: number;
}

/**
 * Attempts due deletions (or only the given provider calls, right after they
 * were queued). Success marks the row done, which is the record that the
 * provider's copy is gone; failure backs off and, after repeated failures,
 * alarms. Only the error class and status are kept, never payloads.
 */
export async function processProviderDeletions(
  exec: Executor,
  deleteCall: DeleteProviderCall,
  now: Date,
  options: { limit?: number; providerCallIds?: readonly string[] } = {},
): Promise<DeletionRunResult> {
  const due = await exec
    .select()
    .from(providerDeletions)
    .where(
      and(
        isNull(providerDeletions.doneAt),
        options.providerCallIds
          ? inArray(providerDeletions.providerCallId, [...options.providerCallIds])
          : lte(providerDeletions.nextAttemptAt, now),
      ),
    )
    .orderBy(asc(providerDeletions.nextAttemptAt))
    .limit(options.limit ?? 50);

  const result: DeletionRunResult = { deleted: 0, failed: 0 };
  for (const row of due) {
    try {
      await deleteCall(row.provider, row.providerCallId);
      await exec
        .update(providerDeletions)
        .set({ doneAt: now, attempts: row.attempts + 1, lastError: null })
        .where(eq(providerDeletions.id, row.id));
      result.deleted += 1;
    } catch (error) {
      const attempts = row.attempts + 1;
      const backoff = Math.min(FIRST_RETRY_MS * 4 ** (attempts - 1), MAX_RETRY_MS);
      await exec
        .update(providerDeletions)
        .set({
          attempts,
          lastError: describe(error),
          nextAttemptAt: new Date(now.getTime() + backoff),
        })
        .where(eq(providerDeletions.id, row.id));
      result.failed += 1;
      if (attempts >= ALARM_AFTER_ATTEMPTS) {
        raiseAlarm("voice.provider_deletion_failing", {
          clinicId: row.clinicId,
          reason: row.reason,
          attempts,
        });
      }
    }
  }
  return result;
}

function describe(error: unknown): string {
  const status =
    typeof error === "object" && error !== null && "status" in error ? String(error.status) : "";
  const name = error instanceof Error ? error.name : typeof error;
  return `${name}${status ? ` ${status}` : ""}`.slice(0, 100);
}
