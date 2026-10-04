import { sql } from "drizzle-orm";

import { safeError } from "@/lib/safe-error";
import { db } from "@/server/db";

import packageJson from "../../../../package.json";

export async function GET() {
  const version = packageJson.version;
  try {
    await db().execute(sql`select 1`);
    return Response.json({ status: "ok", db: "ok", version });
  } catch (error) {
    console.error(JSON.stringify({ msg: "health.db_failed", error: safeError(error) }));
    return Response.json({ status: "degraded", db: "error", version }, { status: 503 });
  }
}
