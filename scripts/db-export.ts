/**
 * Logical export of the **dev** database (docs/06-operations/BACKUP-RESTORE.md).
 *
 *   pnpm db:export
 *
 * Writes one JSON Lines file per table to outputs/db-export-<time>/ and prints
 * only table names and row counts, never data. Refuses to run against the
 * production endpoint: production is protected by Neon's point-in-time
 * restore, and its data must not be copied to a laptop.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { config } from "dotenv";
import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";

import { db, schema } from "@/server/db";

config({ path: [".env.local", ".env"], quiet: true });

const PRODUCTION_ENDPOINT = "ep-small-bar-b1c058o0";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url || url.includes(PRODUCTION_ENDPOINT)) {
    console.error("Refusing to export: DATABASE_URL is missing or points at production.");
    process.exitCode = 1;
    return;
  }
  const dir = join("outputs", `db-export-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  mkdirSync(dir, { recursive: true });

  const tables = (Object.values(schema) as unknown[]).filter((value): value is PgTable =>
    is(value, PgTable),
  );
  let total = 0;
  for (const table of tables) {
    const name = getTableName(table);
    const rows = await db().select().from(table);
    writeFileSync(join(dir, `${name}.jsonl`), rows.map((row) => JSON.stringify(row)).join("\n"));
    console.info(`${name.padEnd(28)} ${rows.length}`);
    total += rows.length;
  }
  console.info(`\n${tables.length} tables, ${total} rows → ${dir} (data not printed)`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "export failed");
  process.exit(1);
});
