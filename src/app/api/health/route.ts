import { sql } from "drizzle-orm";

import { db } from "@/server/db";

import packageJson from "../../../../package.json";

export async function GET() {
  const version = packageJson.version;
  try {
    await db().execute(sql`select 1`);
    return Response.json({ status: "ok", db: "ok", version });
  } catch (error) {
    console.error("health.db_failed", error instanceof Error ? error.message : error);
    return Response.json({ status: "degraded", db: "error", version }, { status: 503 });
  }
}
