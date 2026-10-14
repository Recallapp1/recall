import "server-only";

import { and, count, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";

import type { Executor } from "../db";
import {
  callbackRequests,
  calls,
  followUpPlans,
  jobRuns,
  notifications,
  toolRequests,
} from "../db/schema";
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
  /** Callback notes (free text may describe a complaint). Pending legal review. */
  callbackRequest: 90,
  /** Job run records (counts only): enough history to see a pattern. */
  jobRun: 90,
  /** Voice tool request records (ids and spoken dates): only needed during the call. */
  toolRequest: 30,
} as const;

export interface RetentionResult {
  recordingsCleared: number;
  transcriptsCleared: number;
  callerNumbersCleared: number;
  notificationsDeleted: number;
  followUpsDeleted: number;
  rateLimitsDeleted: number;
  callbacksDeleted: number;
  jobRunsDeleted: number;
  toolRequestsDeleted: number;
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

  const oldCallbacks = await exec
    .delete(callbackRequests)
    .where(
      lt(
        callbackRequests.createdAt,
        new Date(now.getTime() - RETENTION_DAYS.callbackRequest * DAY_MS),
      ),
    )
    .returning({ id: callbackRequests.id });

  const oldRuns = await exec
    .delete(jobRuns)
    .where(lt(jobRuns.startedAt, new Date(now.getTime() - RETENTION_DAYS.jobRun * DAY_MS)))
    .returning({ id: jobRuns.id });

  const oldRequests = await exec
    .delete(toolRequests)
    .where(
      lt(toolRequests.createdAt, new Date(now.getTime() - RETENTION_DAYS.toolRequest * DAY_MS)),
    )
    .returning({ callId: toolRequests.callId });

  return {
    toolRequestsDeleted: oldRequests.length,
    jobRunsDeleted: oldRuns.length,
    callbacksDeleted: oldCallbacks.length,
    rateLimitsDeleted,
    followUpsDeleted: closedPlans.length,
    notificationsDeleted: oldNotifications.length,
    recordingsCleared: recordings.length,
    transcriptsCleared: transcripts.length,
    callerNumbersCleared: numbers.length,
  };
}

/** Open notes this old are deleted within ten days (RETENTION_DAYS.callbackRequest). */
export const CALLBACK_WARNING_DAYS = 80;

/**
 * Open callback notes close to their deletion, per clinic (full audit FA-18):
 * the daily job alarms on them so an unanswered request is not lost unseen.
 * Counts only.
 */
export async function openCallbacksNearingDeletion(
  exec: Executor,
  now: Date,
): Promise<{ clinicId: string; open: number }[]> {
  return exec
    .select({ clinicId: callbackRequests.clinicId, open: count() })
    .from(callbackRequests)
    .where(
      and(
        eq(callbackRequests.status, "open"),
        lt(callbackRequests.createdAt, new Date(now.getTime() - CALLBACK_WARNING_DAYS * DAY_MS)),
      ),
    )
    .groupBy(callbackRequests.clinicId);
}
