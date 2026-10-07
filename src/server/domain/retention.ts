import "server-only";

import { and, inArray, isNotNull, lt, sql } from "drizzle-orm";

import type { Executor } from "../db";
import { calls, followUpPlans, notifications } from "../db/schema";
import { deleteExpiredRateLimits } from "./rate-limit";

/** docs/05-compliance/DATA-RETENTION.md */
export const RETENTION_DAYS = {
  /** The provider deletes the audio itself after this long (agent setting). */
  recording: 30,
  transcript: 90,
  /** Call metadata stays for statistics; the caller's number goes. */
  callerNumber: 730,
  /** Notification log (proof of what was sent). Pending legal review. */
  notificationLog: 365,
  /** Stopped or completed follow-up plans, after closing. Pending legal review. */
  closedFollowUp: 730,
} as const;

export interface RetentionResult {
  recordingsCleared: number;
  transcriptsCleared: number;
  callerNumbersCleared: number;
  notificationsDeleted: number;
  followUpsDeleted: number;
  rateLimitsDeleted: number;
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

  const oldNotifications = await exec
    .delete(notifications)
    .where(
      lt(
        notifications.createdAt,
        new Date(now.getTime() - RETENTION_DAYS.notificationLog * DAY_MS),
      ),
    )
    .returning({ id: notifications.id });

  const closedPlans = await exec
    .delete(followUpPlans)
    .where(
      and(
        inArray(followUpPlans.state, ["stopped", "completed"]),
        lt(
          followUpPlans.stateChangedAt,
          new Date(now.getTime() - RETENTION_DAYS.closedFollowUp * DAY_MS),
        ),
      ),
    )
    .returning({ id: followUpPlans.id });

  const rateLimitsDeleted = await deleteExpiredRateLimits(exec, now);

  return {
    rateLimitsDeleted,
    followUpsDeleted: closedPlans.length,
    notificationsDeleted: oldNotifications.length,
    recordingsCleared: recordings.length,
    transcriptsCleared: transcripts.length,
    callerNumbersCleared: numbers.length,
  };
}
