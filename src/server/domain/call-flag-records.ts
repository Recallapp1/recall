import "server-only";

import { and, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";

import type { CallFlag } from "@/lib/contracts/call";

import type { Executor } from "../db";
import { appointments, callPatients, calls } from "../db/schema";
import { recordAudit } from "./audit";
import { callFlags, type CallFacts } from "./call-flags";

/** Changes recorded shortly after the call ended still belong to it (webhook delays). */
const GRACE_MS = 2 * 60 * 1000;

/**
 * Checks a finished call and stores its flags (POST_CALL_FLAGS). The facts
 * come from our own records: appointments this call created, and
 * cancellations of linked patients' appointments while it lasted. Flags hold
 * only kinds, never words from the call; a flagged call gets an audit entry.
 */
export async function flagCall(
  exec: Executor,
  clinicId: string,
  callId: string,
  now: Date,
): Promise<CallFlag[]> {
  const [call] = await exec
    .select()
    .from(calls)
    .where(and(eq(calls.clinicId, clinicId), eq(calls.id, callId)));
  if (!call) return [];

  const facts = await callFacts(exec, clinicId, call.id, call.startedAt ?? call.createdAt, {
    end: call.endedAt ?? now,
  });
  const flags = callFlags({ transcript: call.transcript, summary: call.summary }, facts);

  await exec
    .update(calls)
    .set({ flags, flaggedAt: now })
    .where(and(eq(calls.clinicId, clinicId), eq(calls.id, call.id)));
  if (flags.length > 0) {
    await recordAudit(exec, {
      clinicId,
      actorUserId: null,
      action: "call.flagged",
      targetType: "call",
      targetId: call.id,
      metadata: { flags },
    });
  }
  return flags;
}

async function callFacts(
  exec: Executor,
  clinicId: string,
  callId: string,
  start: Date,
  { end }: { end: Date },
): Promise<CallFacts> {
  const [created] = await exec
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(eq(appointments.clinicId, clinicId), eq(appointments.callId, callId)))
    .limit(1);

  const linked = await exec
    .select({ patientId: callPatients.patientId })
    .from(callPatients)
    .where(and(eq(callPatients.clinicId, clinicId), eq(callPatients.callId, callId)));
  const [cancelled] =
    linked.length > 0
      ? await exec
          .select({ id: appointments.id })
          .from(appointments)
          .where(
            and(
              eq(appointments.clinicId, clinicId),
              inArray(
                appointments.patientId,
                linked.map((row) => row.patientId),
              ),
              eq(appointments.status, "cancelled"),
              isNotNull(appointments.cancelledAt),
              gte(appointments.cancelledAt, start),
              lte(appointments.cancelledAt, new Date(end.getTime() + GRACE_MS)),
            ),
          )
          .limit(1)
      : [];

  const booked = Boolean(created);
  return { booked, cancelled: Boolean(cancelled), rescheduled: booked && Boolean(cancelled) };
}
