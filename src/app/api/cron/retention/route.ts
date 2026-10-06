import { env } from "@/lib/env";
import { safeError } from "@/lib/safe-error";
import { db } from "@/server/db";
import { applyRetention } from "@/server/domain/retention";

/** Daily (vercel.json). Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  const secret = env().CRON_SECRET;
  if (!secret) {
    console.error(JSON.stringify({ msg: "cron.not_configured", job: "retention" }));
    return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await applyRetention(db(), new Date());
    console.info(JSON.stringify({ msg: "cron.retention", ...result }));
    return Response.json(result);
  } catch (error) {
    console.error(JSON.stringify({ msg: "cron.retention_failed", error: safeError(error) }));
    return Response.json({ error: "Retention failed" }, { status: 500 });
  }
}
