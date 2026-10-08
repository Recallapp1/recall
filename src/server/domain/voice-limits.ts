import "server-only";

import { and, eq, gte, sql } from "drizzle-orm";

import type { Executor } from "../db";
import { calls } from "../db/schema";
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
