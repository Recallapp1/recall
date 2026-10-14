import "server-only";

import { and, asc, eq, gt, inArray, isNull, lt, lte, notExists, sql } from "drizzle-orm";

import type { Executor } from "../db";
import { calls, clinics, providerDeletions } from "../db/schema";
import { raiseAlarm } from "../observability/alarm";
import { RETENTION_DAYS } from "./retention";

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
    // One row per call. An erasure outranks "recording off": the row then also
    // marks the call as erased, so late provider events cannot refill it (G-01).
    .onConflictDoUpdate({
      target: [providerDeletions.provider, providerDeletions.providerCallId],
      set: {
        reason: sql`case when excluded.reason = 'patient_anonymized' then excluded.reason else ${providerDeletions.reason} end`,
      },
    });
}

/**
 * Whether a provider call belongs to an erased patient (KVKK). Its events
 * must store nothing more: a retried or late `call_analyzed` would otherwise
 * write the transcript, summary and recording back (gap review G-01).
 */
export async function isErasedProviderCall(
  exec: Executor,
  clinicId: string,
  provider: string,
  providerCallId: string,
): Promise<boolean> {
  const [row] = await exec
    .select({ id: providerDeletions.id })
    .from(providerDeletions)
    .where(
      and(
        eq(providerDeletions.clinicId, clinicId),
        eq(providerDeletions.provider, provider),
        eq(providerDeletions.providerCallId, providerCallId),
        eq(providerDeletions.reason, "patient_anonymized"),
      ),
    )
    .limit(1);
  return Boolean(row);
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

/** The analysis normally arrives within minutes; after this it is not coming. */
const ANALYSIS_GRACE_MS = 2 * 60 * 60 * 1000;

/**
 * RECORDING_OFF_SWEEP (full audit FA-10): with recording off, the provider's
 * copy is deleted when the call's analysis arrives (handlers.ts). A call whose
 * analysis never arrived is queued here, until the provider's own retention
 * deletes it anyway. Calls with a stored recording link were recorded while
 * recording was on and are left alone. Returns how many calls were queued.
 */
export async function sweepRecordingOffCalls(exec: Executor, now: Date): Promise<number> {
  const callTime = sql`coalesce(${calls.startedAt}, ${calls.createdAt})`;
  const missed = await exec
    .select({
      clinicId: calls.clinicId,
      provider: calls.provider,
      providerCallId: calls.providerCallId,
    })
    .from(calls)
    .innerJoin(clinics, eq(clinics.id, calls.clinicId))
    .where(
      and(
        sql`${clinics.settings} -> 'assistant' ->> 'recordCalls' = 'false'`,
        isNull(calls.recordingUrl),
        lt(callTime, new Date(now.getTime() - ANALYSIS_GRACE_MS)),
        gt(callTime, new Date(now.getTime() - RETENTION_DAYS.recording * 24 * 60 * 60 * 1000)),
        notExists(
          exec
            .select({ one: sql`1` })
            .from(providerDeletions)
            .where(
              and(
                eq(providerDeletions.provider, calls.provider),
                eq(providerDeletions.providerCallId, calls.providerCallId),
              ),
            ),
        ),
      ),
    );
  if (missed.length === 0) return 0;
  const inserted = await exec
    .insert(providerDeletions)
    .values(missed.map((row) => ({ ...row, reason: "recording_off" as const, nextAttemptAt: now })))
    .onConflictDoNothing()
    .returning({ id: providerDeletions.id });
  return inserted.length;
}
