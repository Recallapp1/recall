import { after } from "next/server";

import { env } from "@/lib/env";
import { safeError } from "@/lib/safe-error";
import { rejectUnauthorizedCron } from "@/server/cron-auth";
import { db } from "@/server/db";
import { MAX_INVOCATIONS_PER_DAY } from "@/server/domain/job-runs";
import { runNotificationJob } from "@/server/domain/notifications";
import { smsProvider } from "@/server/notifications/sms";
import { raiseAlarm } from "@/server/observability/alarm";

// The job stops starting new clinics well before the platform's limit.
export const maxDuration = 60;
const BUDGET_MS = 40_000;

/**
 * Daily (vercel.json, 07:00 UTC = 10:00 Istanbul; Hobby fires anywhere in that hour): plans tomorrow's
 * appointment reminders and sends what is due. Until SMS_SENDING_ENABLED is
 * "true" every message is recorded as skipped and no provider is called.
 * Progress is kept in today's run: when the budget runs out the job calls
 * itself to continue, and a manual re-run only does what is left.
 */
export async function GET(request: Request) {
  const config = env();
  const rejected = rejectUnauthorizedCron(request, config.CRON_SECRET, "notifications");
  if (rejected) return rejected;

  try {
    const result = await runNotificationJob(
      db(),
      {
        now: new Date(),
        sendingEnabled: config.SMS_SENDING_ENABLED,
        provider: smsProvider(),
        providerName: config.SMS_SENDING_ENABLED ? config.SMS_PROVIDER : "console",
      },
      ({ clinicId, error }) =>
        console.error(
          JSON.stringify({
            msg: "cron.notifications_clinic_failed",
            clinicId,
            error: safeError(error),
          }),
        ),
      { budgetMs: BUDGET_MS, hourlyReminders: config.HOURLY_REMINDERS === true },
    );
    // Counts only; no recipients, no message text.
    console.info(JSON.stringify({ msg: "cron.notifications", ...result }));

    if (result.failedClinics > 0) {
      raiseAlarm("cron.notifications_clinics_failed", { failed: result.failedClinics });
    }
    if (result.status === "partial") {
      if (result.invocations < MAX_INVOCATIONS_PER_DAY) {
        after(() => continueRun(config.APP_URL, config.CRON_SECRET!));
      } else {
        raiseAlarm("cron.notifications_unfinished", { remaining: result.remaining });
      }
    }
    return Response.json(result);
  } catch (error) {
    raiseAlarm("cron.notifications_failed", {}, error);
    return Response.json({ error: "Notifications failed" }, { status: 500 });
  }
}

/** Starts the next invocation; it picks up the clinics this one did not reach. */
async function continueRun(appUrl: string, secret: string) {
  try {
    await fetch(new URL("/api/cron/notifications", appUrl), {
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // The next invocation runs on; a timeout here only means we stopped waiting.
  }
}
