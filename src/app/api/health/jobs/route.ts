import { connection } from "next/server";

import { env } from "@/lib/env";
import { safeError } from "@/lib/safe-error";
import { secretMatches } from "@/server/cron-auth";
import { db } from "@/server/db";
import { jobHealth } from "@/server/domain/job-runs";

/**
 * Heartbeat of the scheduled jobs for the uptime monitor: 503 when a job has
 * not finished a run in the last 26 hours, its last run failed, or a run is
 * stuck. Only job names, states and times; no clinic or patient data.
 *
 * With HEALTH_JOBS_TOKEN set (audit A6), anonymous callers get only the status
 * (the HTTP code is the same); job details need the `x-health-token` header.
 * Unset keeps today's full answer for everyone.
 */
export async function GET(request: Request) {
  await connection();
  const token = env().HEALTH_JOBS_TOKEN;
  const detailed = !token || secretMatches(request.headers.get("x-health-token") ?? "", token);
  try {
    const jobs = await jobHealth(db(), new Date());
    const healthy = jobs.every((job) => job.healthy);
    const status = healthy ? "ok" : "late";
    return Response.json(detailed ? { status, jobs } : { status }, {
      status: healthy ? 200 : 503,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    console.error(JSON.stringify({ msg: "health.jobs_failed", error: safeError(error) }));
    return Response.json({ status: "error" }, { status: 503 });
  }
}
