import "server-only";

import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { normalizePhone } from "@/lib/phone";

import type { Executor } from "../db";
import { callbackRequests, calls, type Call } from "../db/schema";
import { DomainError } from "./errors";

export interface CallIdentity {
  clinicId: string;
  provider: string;
  providerCallId: string;
  fromNumber?: string | null;
  toNumber?: string | null;
  startedAt?: Date | null;
}

/** Returns our call row for a provider call, creating it on first sight. */
export async function upsertCall(exec: Executor, identity: CallIdentity): Promise<Call> {
  const [row] = await exec
    .insert(calls)
    .values({
      clinicId: identity.clinicId,
      provider: identity.provider,
      providerCallId: identity.providerCallId,
      fromNumber: normalizePhone(identity.fromNumber),
      toNumber: normalizePhone(identity.toNumber),
      startedAt: identity.startedAt ?? new Date(),
    })
    .onConflictDoUpdate({
      target: [calls.provider, calls.providerCallId],
      set: { updatedAt: sql`now()` },
    })
    .returning();

  if (row.clinicId !== identity.clinicId) {
    // A provider call id can never move between tenants.
    throw new DomainError("CLINIC_NOT_FOUND", "Call belongs to another clinic");
  }
  return row;
}

type Outcome = NonNullable<Call["outcome"]>;

/** Higher wins: a call that booked and then asked a question is still "booked". */
const OUTCOME_PRIORITY: Outcome[] = [
  "other",
  "abandoned",
  "info",
  "callback",
  "transferred",
  "cancelled",
  "rescheduled",
  "booked",
];

export async function markCallOutcome(
  exec: Executor,
  clinicId: string,
  callId: string,
  outcome: Outcome,
) {
  const lower = OUTCOME_PRIORITY.slice(0, OUTCOME_PRIORITY.indexOf(outcome));
  await exec
    .update(calls)
    .set({ outcome })
    .where(
      and(
        eq(calls.id, callId),
        eq(calls.clinicId, clinicId),
        lower.length > 0
          ? or(isNull(calls.outcome), inArray(calls.outcome, lower))
          : isNull(calls.outcome),
      ),
    );
}

export interface CallReport {
  endedAt?: Date | null;
  startedAt?: Date | null;
  durationSeconds?: number | null;
  endedReason?: string | null;
  summary?: string | null;
  transcript?: string | null;
  recordingUrl?: string | null;
  costUsd?: number | null;
}

const ABANDONED_UNDER_SECONDS = 10;

/**
 * Records what is known about a finished call. Providers may report in
 * several events (ended, then analyzed) and retry them, so only fields present
 * in this report are written and earlier values are never erased.
 */
export async function completeCall(exec: Executor, call: Call, report: CallReport) {
  const updates: Partial<typeof calls.$inferInsert> = {};
  if (report.startedAt) updates.startedAt = report.startedAt;
  if (report.endedAt) updates.endedAt = report.endedAt;
  if (report.durationSeconds != null) updates.durationSeconds = Math.round(report.durationSeconds);
  if (report.endedReason) updates.endedReason = report.endedReason;
  if (report.summary) updates.summary = report.summary;
  if (report.transcript) updates.transcript = report.transcript;
  if (report.recordingUrl) updates.recordingUrl = report.recordingUrl;
  if (report.costUsd != null) updates.costUsd = report.costUsd.toFixed(4);

  if (Object.keys(updates).length > 0) {
    await exec
      .update(calls)
      .set(updates)
      .where(and(eq(calls.id, call.id), eq(calls.clinicId, call.clinicId)));
  }

  // Derived outcomes go through the priority guard, so a booking made during
  // the call is never overwritten by "info".
  const reason = (report.endedReason ?? call.endedReason ?? "").toLowerCase();
  const duration = report.durationSeconds ?? call.durationSeconds;
  let derived: Outcome | null = null;
  if (reason.includes("transfer") || reason.includes("forward")) derived = "transferred";
  else if (duration != null && duration < ABANDONED_UNDER_SECONDS) derived = "abandoned";
  else if (duration != null || report.endedAt) derived = "info";
  if (derived) await markCallOutcome(exec, call.clinicId, call.id, derived);
}

/** Longest callback reason kept (it may describe a complaint: health data, KVKK). */
export const CALLBACK_REASON_MAX = 500;

/**
 * One open note per call and number: a retried or repeated tool call returns
 * the note that is already there (`created: false`). With `onlyIfExisting`
 * nothing is inserted.
 */
export async function createCallbackRequest(
  exec: Executor,
  input: {
    clinicId: string;
    callId: string | null;
    reason: string;
    patientName?: string | null;
    phone?: string | null;
  },
  options: { onlyIfExisting?: boolean } = {},
): Promise<{ id: string; created: boolean } | null> {
  const phone = normalizePhone(input.phone);
  const findExisting = async () => {
    if (!input.callId || !phone) return null;
    const [row] = await exec
      .select({ id: callbackRequests.id })
      .from(callbackRequests)
      .where(
        and(
          eq(callbackRequests.clinicId, input.clinicId),
          eq(callbackRequests.callId, input.callId),
          eq(callbackRequests.phone, phone),
          eq(callbackRequests.status, "open"),
        ),
      );
    return row ? { id: row.id, created: false } : null;
  };

  const existing = await findExisting();
  if (existing || options.onlyIfExisting) return existing;
  const [row] = await exec
    .insert(callbackRequests)
    .values({
      clinicId: input.clinicId,
      callId: input.callId,
      reason: input.reason.trim().slice(0, CALLBACK_REASON_MAX),
      patientName: input.patientName?.trim().slice(0, 100) || null,
      phone,
    })
    // A concurrent duplicate loses the race on the partial unique index.
    .onConflictDoNothing()
    .returning({ id: callbackRequests.id });
  return row ? { id: row.id, created: true } : await findExisting();
}
