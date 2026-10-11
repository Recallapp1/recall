import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb } from "@/test/db";

import { restoreAndVerify } from "../../../scripts/db-restore-verify";
import { bookAppointment } from "../domain/appointments";
import type { Database } from ".";
import * as schema from "./schema";

/*
 * R2 4m: an export in the `pnpm db:export` format comes back complete in a
 * fresh database, every foreign key satisfied; a broken export is caught.
 */

let db: Database;
let close: () => Promise<void>;
let dir: string;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  const clinic = await createTestClinic(db);
  await bookAppointment(db, clinic.ctx, {
    serviceId: clinic.serviceId,
    practitionerId: clinic.practitionerId,
    date: "2026-10-05",
    time: "10:00",
    patientName: "Yedek Hasta",
    patientPhone: "+905320000095",
    source: "panel",
    now: new Date("2026-10-04T09:00:00Z"),
  });
  dir = mkdtempSync(join(tmpdir(), "recall-export-"));
  // The same files `pnpm db:export` writes.
  for (const table of Object.values(schema) as unknown[]) {
    if (!is(table, PgTable)) continue;
    const rows = await db.select().from(table);
    writeFileSync(
      join(dir, `${getTableName(table)}.jsonl`),
      rows.map((row) => JSON.stringify(row)).join("\n"),
    );
  }
});

afterAll(async () => {
  rmSync(dir, { recursive: true, force: true });
  await close();
});

describe("restoreAndVerify (R2 4m)", () => {
  it("restores every row with its foreign keys", async () => {
    const report = await restoreAndVerify(dir);
    expect(report.ok).toBe(true);
    const counts = Object.fromEntries(report.tables.map((t) => [t.name, t.restored]));
    expect(counts).toMatchObject({ clinics: 1, patients: 1, appointments: 1 });
  }, 120_000);

  it("fails when a child row's parent is missing from the export", async () => {
    writeFileSync(join(dir, "patients.jsonl"), "");
    await expect(restoreAndVerify(dir)).rejects.toThrow(/Foreign keys never satisfied/);
  }, 120_000);
});
