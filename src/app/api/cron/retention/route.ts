import { env } from "@/lib/env";
import { rejectUnauthorizedCron } from "@/server/cron-auth";
import { db } from "@/server/db";
import { beginRun, endRun } from "@/server/domain/job-runs";
import { processProviderDeletions } from "@/server/domain/provider-deletions";
import { applyRetention } from "@/server/domain/retention";
import { raiseAlarm } from "@/server/observability/alarm";
import { deleteVoiceProviderCall } from "@/server/voice/sync";

export const maxDuration = 60;

/** Daily (vercel.json). Recorded in job_runs so a missed run shows on /api/health/jobs. */
export async function GET(request: Request) {
  const rejected = rejectUnauthorizedCron(request, env().CRON_SECRET, "retention");
  if (rejected) return rejected;

  const now = new Date();
  const run = await beginRun(db(), "retention", now).catch(() => null);
  try {
    const retention = await applyRetention(db(), now);
    // Provider-side deletions that failed earlier (audit P-10).
    const deletions = await processProviderDeletions(db(), deleteVoiceProviderCall, now, {
      limit: 50,
    });
    const result = {
      ...retention,
      providerDeletionsDone: deletions.deleted,
      providerDeletionsFailed: deletions.failed,
    };
    console.info(JSON.stringify({ msg: "cron.retention", ...result }));
    if (run) await endRun(db(), run.id, "succeeded", { ...result }, new Date());
    return Response.json(result);
  } catch (error) {
    raiseAlarm("cron.retention_failed", {}, error);
    if (run) await endRun(db(), run.id, "failed", {}, new Date()).catch(() => {});
    return Response.json({ error: "Retention failed" }, { status: 500 });
  }
}
