import { env } from "@/lib/env";
import { safeError } from "@/lib/safe-error";
import { rejectUnauthorizedCron } from "@/server/cron-auth";
import { db } from "@/server/db";
import { applyRetention } from "@/server/domain/retention";

/** Daily (vercel.json). */
export async function GET(request: Request) {
  const rejected = rejectUnauthorizedCron(request, env().CRON_SECRET, "retention");
  if (rejected) return rejected;

  try {
    const result = await applyRetention(db(), new Date());
    console.info(JSON.stringify({ msg: "cron.retention", ...result }));
    return Response.json(result);
  } catch (error) {
    console.error(JSON.stringify({ msg: "cron.retention_failed", error: safeError(error) }));
    return Response.json({ error: "Retention failed" }, { status: 500 });
  }
}
