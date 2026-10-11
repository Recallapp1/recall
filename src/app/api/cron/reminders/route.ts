import { env } from "@/lib/env";
import { safeError } from "@/lib/safe-error";
import { rejectUnauthorizedCron } from "@/server/cron-auth";
import { db } from "@/server/db";
import { runHourlyReminders } from "@/server/domain/notifications";
import { smsProvider } from "@/server/notifications/sms";
import { raiseAlarm } from "@/server/observability/alarm";

export const maxDuration = 60;

/**
 * Hourly appointment reminders (R2 5b), honouring each clinic's
 * smsReminderHoursBefore. Off unless HOURLY_REMINDERS is "true" (then the
 * daily notifications job stops planning reminders). Not scheduled in
 * vercel.json until Vercel Pro allows hourly cron: then add
 * {"path": "/api/cron/reminders", "schedule": "0 * * * *"}. Sending keeps
 * every lock: master switch, provider, clinic setting, opt-out, send window, caps.
 */
export async function GET(request: Request) {
  const config = env();
  const rejected = rejectUnauthorizedCron(request, config.CRON_SECRET, "reminders");
  if (rejected) return rejected;
  if (config.HOURLY_REMINDERS !== true) {
    return Response.json({ status: "disabled" }, { status: 404 });
  }
  try {
    const result = await runHourlyReminders(
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
            msg: "cron.reminders_clinic_failed",
            clinicId,
            error: safeError(error),
          }),
        ),
    );
    console.info(JSON.stringify({ msg: "cron.reminders", ...result }));
    if (result.failedClinics > 0) {
      raiseAlarm("cron.reminders_clinics_failed", { failed: result.failedClinics });
    }
    return Response.json(result);
  } catch (error) {
    raiseAlarm("cron.reminders_failed", {}, error);
    return Response.json({ error: "Reminders failed" }, { status: 500 });
  }
}
