import "server-only";

import { and, isNotNull, lt, sql } from "drizzle-orm";

import type { Executor } from "../db";
import { calls } from "../db/schema";

/** docs/05-compliance/DATA-RETENTION.md */
export const RETENTION_DAYS = {
  /** The provider deletes the audio itself after this long (agent setting). */
  recording: 30,
  transcript: 90,
  /** Call metadata stays for statistics; the caller's number goes. */
  callerNumber: 730,
} as const;

export interface RetentionResult {
  recordingsCleared: number;
  transcriptsCleared: number;
  callerNumbersCleared: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Clears personal data from calls past its retention period, across all
 * clinics. Idempotent; only counts are reported, never content.
 */
export async function applyRetention(exec: Executor, now: Date): Promise<RetentionResult> {
  const callTime = sql`coalesce(${calls.startedAt}, ${calls.createdAt})`;
  const olderThan = (days: number) => lt(callTime, new Date(now.getTime() - days * DAY_MS));

  const recordings = await exec
    .update(calls)
    .set({ recordingUrl: null })
    .where(and(isNotNull(calls.recordingUrl), olderThan(RETENTION_DAYS.recording)))
    .returning({ id: calls.id });
  const transcripts = await exec
    .update(calls)
    .set({ transcript: null })
    .where(and(isNotNull(calls.transcript), olderThan(RETENTION_DAYS.transcript)))
    .returning({ id: calls.id });
  const numbers = await exec
    .update(calls)
    .set({ fromNumber: null })
    .where(and(isNotNull(calls.fromNumber), olderThan(RETENTION_DAYS.callerNumber)))
    .returning({ id: calls.id });

  return {
    recordingsCleared: recordings.length,
    transcriptsCleared: transcripts.length,
    callerNumbersCleared: numbers.length,
  };
}
