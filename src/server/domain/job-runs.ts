import "server-only";

import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";

import type { Executor } from "../db";
import { jobRunClinics, jobRuns } from "../db/schema";

/**
 * Persistent record of scheduled jobs (docs/HARDENING-2026-10.md). A run is
 * per job per UTC day: every invocation that day continues the same run and
 * skips the clinics it already finished, so a timeout loses no work and a
 * re-run repeats none.
 */

export type JobName = "notifications" | "retention" | "reminders";
export type RunStatus = "running" | "partial" | "succeeded" | "failed";

/** A run that has not moved for this long was cut off (timeout, crash). */
export const STALE_HEARTBEAT_MS = 10 * 60 * 1000;
/** A job whose last good run is older than this missed its daily slot. */
export const MAX_RUN_AGE_MS = 26 * 60 * 60 * 1000;
/** The hourly reminders job (HOURLY_REMINDERS): two missed hours and a margin. */
export const HOURLY_MAX_RUN_AGE_MS = 150 * 60 * 1000;
/** Self-continuations per day, so a failure can never loop forever. */
export const MAX_INVOCATIONS_PER_DAY = 10;

export interface JobRun {
  id: string;
  status: RunStatus;
  invocations: number;
}

/** Opens today's run, or joins it (counting the invocation). */
export async function beginRun(db: Executor, job: JobName, now: Date): Promise<JobRun> {
  const runOn = now.toISOString().slice(0, 10);
  const [row] = await db
    .insert(jobRuns)
    .values({ job, runOn, startedAt: now, heartbeatAt: now })
    .onConflictDoUpdate({
      target: [jobRuns.job, jobRuns.runOn],
      set: {
        invocations: sql`${jobRuns.invocations} + 1`,
        heartbeatAt: now,
        // A finished run stays finished; anything else is running again.
        status: sql`case when ${jobRuns.status} = 'succeeded' then 'succeeded' else 'running' end`,
        finishedAt: sql`case when ${jobRuns.status} = 'succeeded' then ${jobRuns.finishedAt} else null end`,
      },
    })
    .returning({ id: jobRuns.id, status: jobRuns.status, invocations: jobRuns.invocations });
  return { id: row!.id, status: row!.status as RunStatus, invocations: row!.invocations };
}

export async function finishedClinicIds(db: Executor, runId: string): Promise<Set<string>> {
  const rows = await db
    .select({ clinicId: jobRunClinics.clinicId })
    .from(jobRunClinics)
    .where(and(eq(jobRunClinics.runId, runId), eq(jobRunClinics.status, "done")));
  return new Set(rows.map((r) => r.clinicId));
}

/** Records one clinic's outcome and moves the heartbeat. */
export async function recordClinic(
  db: Executor,
  runId: string,
  clinicId: string,
  outcome: { status: "done" | "failed"; errorCode?: string },
  now: Date,
): Promise<void> {
  await db
    .insert(jobRunClinics)
    .values({
      runId,
      clinicId,
      status: outcome.status,
      errorCode: outcome.errorCode,
      finishedAt: now,
    })
    .onConflictDoUpdate({
      target: [jobRunClinics.runId, jobRunClinics.clinicId],
      set: { status: outcome.status, errorCode: outcome.errorCode ?? null, finishedAt: now },
    });
  await db.update(jobRuns).set({ heartbeatAt: now }).where(eq(jobRuns.id, runId));
}

export async function endRun(
  db: Executor,
  runId: string,
  status: Exclude<RunStatus, "running">,
  result: Record<string, unknown>,
  now: Date,
): Promise<void> {
  await db
    .update(jobRuns)
    .set({
      status,
      result,
      heartbeatAt: now,
      finishedAt: status === "partial" ? null : now,
    })
    .where(eq(jobRuns.id, runId));
}

export interface JobHealth {
  job: JobName;
  healthy: boolean;
  lastSucceededAt: string | null;
  /** Why it is unhealthy: never ran, last run failed, stuck, or too old. */
  problem: "never_succeeded" | "too_old" | "last_run_failed" | "stuck" | null;
}

/**
 * The heartbeat behind /api/health/jobs (no personal data: times and states
 * only). With HOURLY_REMINDERS the hourly job is watched too: switched on
 * without its cron entry, reminders would otherwise stop silently (FA-13).
 */
export async function jobHealth(
  db: Executor,
  now: Date,
  options: { hourlyReminders?: boolean } = {},
): Promise<JobHealth[]> {
  const jobs: JobName[] = [
    "notifications",
    "retention",
    ...(options.hourlyReminders ? (["reminders"] as const) : []),
  ];
  const latest = await db
    .select({
      job: jobRuns.job,
      status: jobRuns.status,
      heartbeatAt: jobRuns.heartbeatAt,
      finishedAt: jobRuns.finishedAt,
    })
    .from(jobRuns)
    .where(inArray(jobRuns.job, jobs))
    .orderBy(desc(jobRuns.runOn));
  const succeeded = await db
    .select({ job: jobRuns.job, finishedAt: jobRuns.finishedAt })
    .from(jobRuns)
    .where(
      and(
        inArray(jobRuns.job, jobs),
        eq(jobRuns.status, "succeeded"),
        isNotNull(jobRuns.finishedAt),
      ),
    )
    .orderBy(desc(jobRuns.finishedAt));

  return jobs.map((job) => {
    const last = latest.find((r) => r.job === job);
    const good = succeeded.find((r) => r.job === job)?.finishedAt ?? null;
    let problem: JobHealth["problem"] = null;
    if (!good) problem = "never_succeeded";
    else if (last?.status === "failed") problem = "last_run_failed";
    else if (
      (last?.status === "running" || last?.status === "partial") &&
      now.getTime() - last.heartbeatAt.getTime() > STALE_HEARTBEAT_MS
    ) {
      problem = "stuck";
    } else if (
      now.getTime() - good.getTime() >
      (job === "reminders" ? HOURLY_MAX_RUN_AGE_MS : MAX_RUN_AGE_MS)
    ) {
      problem = "too_old";
    }
    return {
      job,
      healthy: problem === null,
      lastSucceededAt: good?.toISOString() ?? null,
      problem,
    };
  });
}
