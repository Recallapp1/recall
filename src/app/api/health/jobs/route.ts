import { connection } from "next/server";

import { safeError } from "@/lib/safe-error";
import { db } from "@/server/db";
import { jobHealth } from "@/server/domain/job-runs";

/**
 * Heartbeat of the scheduled jobs for the uptime monitor: 503 when a job has
 * not finished a run in the last 26 hours, its last run failed, or a run is
 * stuck. Only job names, states and times; no clinic or patient data.
 */
export async function GET() {
  await connection();
  try {
    const jobs = await jobHealth(db(), new Date());
    const healthy = jobs.every((job) => job.healthy);
    return Response.json(
      { status: healthy ? "ok" : "late", jobs },
      { status: healthy ? 200 : 503 },
    );
  } catch (error) {
    console.error(JSON.stringify({ msg: "health.jobs_failed", error: safeError(error) }));
    return Response.json({ status: "error" }, { status: 503 });
  }
}
