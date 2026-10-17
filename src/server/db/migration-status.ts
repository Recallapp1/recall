import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { sql } from "drizzle-orm";

import type { Executor } from ".";

/**
 * Whether a database has applied every migration in the repository. Production
 * applies the whole journal on every deploy (`vercel-build`), so a database that
 * matches the journal matches production. Read-only: it never migrates.
 */

export interface JournalEntry {
  tag: string;
  when: number;
}

export interface MigrationStatus {
  applied: number;
  expected: number;
  /** Journal tags this database has not applied, oldest first. */
  pending: string[];
}

export function journalEntries(dir = "drizzle"): JournalEntry[] {
  const journal = JSON.parse(readFileSync(join(dir, "meta", "_journal.json"), "utf8")) as {
    entries: JournalEntry[];
  };
  return journal.entries.map(({ tag, when }) => ({ tag, when }));
}

export async function migrationStatus(exec: Executor, dir = "drizzle"): Promise<MigrationStatus> {
  const entries = journalEntries(dir);
  const result = (await exec.execute(
    sql`select created_at from drizzle.__drizzle_migrations`,
  )) as unknown as
    { rows?: Array<{ created_at: string | number }> } | Array<{ created_at: string | number }>;
  const rows = Array.isArray(result) ? result : (result.rows ?? []);
  // drizzle-kit records each migration by its journal timestamp.
  const applied = new Set(rows.map((row) => Number(row.created_at)));
  return {
    applied: rows.length,
    expected: entries.length,
    pending: entries.filter((entry) => !applied.has(entry.when)).map((entry) => entry.tag),
  };
}

/** Why a script must not go on, or null when the database is up to date. */
export function migrationRefusal(status: MigrationStatus): string | null {
  if (status.pending.length === 0) return null;
  return (
    `Veritabanında ${status.pending.length} migration uygulanmamış ` +
    `(${status.applied}/${status.expected}): ${status.pending.join(", ")}. ` +
    "Canlı bu migration'ları zaten çalıştırıyor; bu veritabanı geride. " +
    "Uygulamak için `pnpm db:migrate` (veritabanını değiştirir: önce Recall sahibine sor)."
  );
}
