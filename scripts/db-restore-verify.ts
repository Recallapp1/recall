/**
 * Restore check for a logical export (`pnpm db:export`, R2 4m). Loads the
 * export into a throwaway in-memory PostgreSQL (PGlite) with the real
 * migrations, never into a remote database, and checks that every row comes
 * back and every foreign key holds. Prints table names and counts only.
 *
 *   pnpm db:restore-verify outputs/db-export-<time>
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "../src/server/db/schema";

export interface RestoreReport {
  tables: { name: string; exported: number; restored: number }[];
  ok: boolean;
}

function tablesOf(): PgTable[] {
  return (Object.values(schema) as unknown[]).filter((value): value is PgTable =>
    is(value, PgTable),
  );
}

const snakeCase = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/** Export rows use Drizzle's property names; the database wants column names. */
function toColumns(table: PgTable, row: Record<string, unknown>): Record<string, unknown> {
  const columns = getTableColumns(table);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const column = columns[key];
    // Columns without an explicit name get theirs from the snake_case casing.
    if (column) out[column.name === key ? snakeCase(key) : column.name] = value;
  }
  return out;
}

export async function restoreAndVerify(dir: string): Promise<RestoreReport> {
  if (!existsSync(dir)) throw new Error(`No export at ${dir}`);
  const client = new PGlite({ extensions: { btree_gist } });
  try {
    await migrate(drizzle({ client, casing: "snake_case" }), { migrationsFolder: "./drizzle" });
    const files = new Set(readdirSync(dir));
    const pending = tablesOf()
      .map((table) => {
        const name = getTableName(table);
        const file = `${name}.jsonl`;
        const text = files.has(file) ? readFileSync(join(dir, file), "utf8") : "";
        const rows = text.trim()
          ? text.split("\n").map((line) => toColumns(table, JSON.parse(line)))
          : [];
        return { table, name, rows };
      })
      .filter((entry) => entry.rows.length > 0 || files.has(`${entry.name}.jsonl`));

    // Insert in whatever order the foreign keys allow: a table whose parents
    // are not there yet is retried, so every key is checked on the way in.
    const restored = new Map<string, number>();
    let remaining = pending;
    while (remaining.length > 0) {
      const next: typeof remaining = [];
      for (const entry of remaining) {
        if (entry.rows.length === 0) {
          restored.set(entry.name, 0);
          continue;
        }
        try {
          await client.query("BEGIN");
          await client.query(
            `INSERT INTO "${entry.name}" SELECT * FROM json_populate_recordset(NULL::"${entry.name}", $1)`,
            [JSON.stringify(entry.rows)],
          );
          await client.query("COMMIT");
          restored.set(entry.name, entry.rows.length);
        } catch (error) {
          await client.query("ROLLBACK");
          if ((error as { code?: string }).code !== "23503") throw error;
          next.push(entry);
        }
      }
      if (next.length === remaining.length) {
        throw new Error(`Foreign keys never satisfied for: ${next.map((e) => e.name).join(", ")}`);
      }
      remaining = next;
    }

    const tables = [];
    for (const entry of pending) {
      const result = await client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM "${entry.name}"`,
      );
      tables.push({ name: entry.name, exported: entry.rows.length, restored: result.rows[0]!.n });
    }
    return { tables, ok: tables.every((t) => t.exported === t.restored) };
  } finally {
    await client.close();
  }
}

async function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error("Usage: pnpm db:restore-verify outputs/db-export-<time>");
    process.exit(1);
  }
  const report = await restoreAndVerify(dir);
  for (const t of report.tables) {
    console.info(`${t.name.padEnd(28)} ${String(t.exported).padStart(6)} → ${t.restored}`);
  }
  console.info(
    report.ok ? "\nRestore check passed (counts only shown)." : "\nRestore check FAILED.",
  );
  process.exit(report.ok ? 0 : 1);
}

if (process.argv[1]?.endsWith("db-restore-verify.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "restore check failed");
    process.exit(1);
  });
}
