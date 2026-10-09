import "server-only";

import { and, count, eq, gte, inArray, sql } from "drizzle-orm";

import type { Executor } from "../db";
import { ACTIVE_APPOINTMENT_STATUSES, appointments, calls } from "../db/schema";
import { raiseAlarm } from "../observability/alarm";
import type { ClinicContext } from "./clinics";
import { consumeRateLimit, hashKey } from "./rate-limit";
import { localToday, localToUtc } from "./time";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type InboundRejection =
  "daily_minutes" | "clinic_hourly" | "hidden_hourly" | "number_hourly" | "number_daily";

/**
 * Whether a phone call may reach the assistant (audit P-08). Every voice
 * minute is billed, so a caller (or a script) cannot dial the clinic without
 * end, and a clinic's day has a minute budget. Counters are hashed per clinic
 * and number; the caller's number is never stored or logged in clear.
 */
export async function admitInboundCall(
  exec: Executor,
  { clinic, settings }: ClinicContext,
  callerPhone: string | null,
  now: Date,
): Promise<{ admitted: true } | { admitted: false; reason: InboundRejection }> {
  const { limits } = settings;
  const today = localToday(now, clinic.timezone);

  const minutes = await voiceMinutesSince(exec, clinic.id, localToUtc(today, 0, clinic.timezone));
  if (minutes >= limits.dailyVoiceMinutes) {
    // One alarm per clinic per day: the Recall team decides whether to raise the budget.
    const firstToday = await consumeRateLimit(
      exec,
      `voice-alarm:minutes:${hashKey(clinic.id, today)}`,
      { limit: 1, windowMs: DAY },
      now,
    );
    if (firstToday.allowed) {
      raiseAlarm("voice.daily_minutes_reached", {
        clinicId: clinic.id,
        minutes: Math.round(minutes),
        limit: limits.dailyVoiceMinutes,
      });
    }
    return { admitted: false, reason: "daily_minutes" };
  }

  const counters: Array<[InboundRejection, string, number, number]> = [
    ["clinic_hourly", hashKey(clinic.id), limits.callsPerHour, HOUR],
    ...(callerPhone
      ? ([
          ["number_hourly", hashKey(clinic.id, callerPhone), limits.callsPerNumberPerHour, HOUR],
          ["number_daily", hashKey(clinic.id, callerPhone), limits.callsPerNumberPerDay, DAY],
        ] as Array<[InboundRejection, string, number, number]>)
      : ([
          ["hidden_hourly", hashKey(clinic.id, "hidden"), limits.hiddenCallsPerHour, HOUR],
        ] as Array<[InboundRejection, string, number, number]>)),
  ];
  for (const [reason, subject, limit, windowMs] of counters) {
    const result = await consumeRateLimit(
      exec,
      `voice-inbound:${reason}:${subject}`,
      { limit, windowMs },
      now,
    );
    if (!result.allowed) return { admitted: false, reason };
  }
  return { admitted: true };
}

/** Billed minutes of the clinic's calls that started since `since`. */
export async function voiceMinutesSince(
  exec: Executor,
  clinicId: string,
  since: Date,
): Promise<number> {
  const [row] = await exec
    .select({ seconds: sql<string | null>`sum(${calls.durationSeconds})` })
    .from(calls)
    .where(and(eq(calls.clinicId, clinicId), gte(calls.startedAt, since)));
  return Number(row?.seconds ?? 0) / 60;
}

export interface ClinicUsage {
  /** Billed voice minutes since local midnight. */
  voiceMinutesToday: number;
  callsToday: number;
  callsLastHour: number;
  /** Active appointments the assistant created since local midnight. */
  voiceBookingsToday: number;
}

/** Today's usage against the limits, for the clinic's read-only view (audit A8). */
export async function clinicUsage(
  exec: Executor,
  { clinic }: ClinicContext,
  now: Date,
): Promise<ClinicUsage> {
  const midnight = localToUtc(localToday(now, clinic.timezone), 0, clinic.timezone);
  const hourAgo = new Date(now.getTime() - HOUR);
  const callsSince = async (since: Date) => {
    const [row] = await exec
      .select({ value: count() })
      .from(calls)
      .where(and(eq(calls.clinicId, clinic.id), gte(calls.createdAt, since)));
    return row?.value ?? 0;
  };
  const [minutes, today, lastHour, [bookings]] = await Promise.all([
    voiceMinutesSince(exec, clinic.id, midnight),
    callsSince(midnight),
    callsSince(hourAgo),
    exec
      .select({ value: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.clinicId, clinic.id),
          eq(appointments.source, "voice"),
          inArray(appointments.status, [...ACTIVE_APPOINTMENT_STATUSES]),
          gte(appointments.createdAt, midnight),
        ),
      ),
  ]);
  return {
    voiceMinutesToday: Math.round(minutes * 10) / 10,
    callsToday: today,
    callsLastHour: lastHour,
    voiceBookingsToday: bookings?.value ?? 0,
  };
}
