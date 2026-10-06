import { env } from "@/lib/env";
import { safeError } from "@/lib/safe-error";
import { rejectUnauthorizedCron } from "@/server/cron-auth";
import { db } from "@/server/db";
import { runNotificationJob } from "@/server/domain/notifications";
import { smsProvider } from "@/server/notifications/sms";

/**
 * Daily (vercel.json, 07:00 UTC = 10:00 Istanbul): plans tomorrow's
 * appointment reminders and sends what is due. Until SMS_SENDING_ENABLED is
 * "true" every message is recorded as skipped and no provider is called.
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
    );
    // Counts only; no recipients, no message text.
    console.info(JSON.stringify({ msg: "cron.notifications", ...result }));
    return Response.json(result);
  } catch (error) {
    console.error(JSON.stringify({ msg: "cron.notifications_failed", error: safeError(error) }));
    return Response.json({ error: "Notifications failed" }, { status: 500 });
  }
}
