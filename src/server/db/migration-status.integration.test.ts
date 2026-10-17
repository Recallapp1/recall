import { readFileSync } from "node:fs";

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDb } from "@/test/db";

import type { Database } from ".";
import { journalEntries, migrationRefusal, migrationStatus } from "./migration-status";

/*
 * The dev branch fell two migrations behind production unnoticed (2026-10-17):
 * the A16 rehearsal stopped on a missing column, and C5 would have failed the
 * same way. Production applies the whole journal on every deploy, so a
 * database matches production when it has applied every journal entry.
 */

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

describe("migration status", () => {
  it("reads every migration of the journal", () => {
    const entries = journalEntries();
    expect(entries.length).toBeGreaterThanOrEqual(21);
    expect(entries.at(-1)?.tag).toMatch(/^\d{4}_/);
  });

  it("a fully migrated database has nothing pending and is not refused", async () => {
    const status = await migrationStatus(db);
    expect(status.pending).toEqual([]);
    expect(status.applied).toBe(journalEntries().length);
    expect(migrationRefusal(status)).toBeNull();
  });

  it("a database behind the journal lists what is missing and is refused", async () => {
    const newest = journalEntries().at(-1)!;
    await db.execute(
      sql`delete from drizzle.__drizzle_migrations where created_at = ${newest.when}`,
    );
    const status = await migrationStatus(db);
    expect(status.pending).toEqual([newest.tag]);
    const refusal = migrationRefusal(status);
    expect(refusal).toContain(newest.tag);
    expect(refusal).toContain("pnpm db:migrate");
    expect(refusal).toContain("Recall sahibine sor");
  });
});

describe("scripts that talk to the dev assistant check the database first", () => {
  it.each(["scripts/dev-tunnel.ts", "scripts/voice-eval/run.ts"])(
    "%s refuses before syncing the agent or calling",
    (path) => {
      const source = readFileSync(path, "utf8");
      const check = source.indexOf("migrationRefusal(");
      expect(check, "calls migrationRefusal").toBeGreaterThan(-1);
      const firstEffect = Math.min(
        ...["syncAgents(", "syncDevAgent(", "runScenarios("]
          .map((name) => source.indexOf(name, source.indexOf("async function main")))
          .filter((index) => index > -1),
      );
      expect(check).toBeLessThan(firstEffect);
    },
  );
});
