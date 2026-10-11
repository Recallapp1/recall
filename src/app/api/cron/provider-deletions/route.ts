import { env } from "@/lib/env";
import { rejectUnauthorizedCron } from "@/server/cron-auth";
import { db } from "@/server/db";
import { processProviderDeletions } from "@/server/domain/provider-deletions";
import { raiseAlarm } from "@/server/observability/alarm";
import { deleteVoiceProviderCall } from "@/server/voice/sync";

export const maxDuration = 60;

/**
 * Retell deletion queue on its own, so it can run hourly (R2 5a): erasures
 * and "recording off" deletions reach the provider within an hour instead
 * of with the daily retention job. Off unless DELETION_QUEUE_HOURLY is
 * "true"; not scheduled in vercel.json until Vercel Pro allows hourly cron
 * (then add {"path": "/api/cron/provider-deletions", "schedule": "0 * * * *"}).
 * The daily retention job keeps processing the queue either way.
 */
export async function GET(request: Request) {
  const config = env();
  const rejected = rejectUnauthorizedCron(request, config.CRON_SECRET, "provider-deletions");
  if (rejected) return rejected;
  if (config.DELETION_QUEUE_HOURLY !== true) {
    return Response.json({ status: "disabled" }, { status: 404 });
  }
  try {
    const result = await processProviderDeletions(db(), deleteVoiceProviderCall, new Date(), {
      limit: 50,
    });
    console.info(JSON.stringify({ msg: "cron.provider_deletions", ...result }));
    return Response.json(result);
  } catch (error) {
    raiseAlarm("cron.provider_deletions_failed", {}, error);
    return Response.json({ error: "Provider deletions failed" }, { status: 500 });
  }
}
