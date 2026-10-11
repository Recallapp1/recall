import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/server/db/schema";
import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import type { Database } from "../db";
import { getCall, listCalls, scopeFor } from "./panel";

const PHONE = "+905320000072";

let today: Database;
let dropped: Database;
const closers: (() => Promise<void>)[] = [];

beforeAll(async () => {
  const a = await createTestDb();
  const b = await createTestDb();
  today = a.db;
  dropped = b.db;
  closers.push(a.close, b.close);
  // up.sql of the P-12 proposal (branch docs/P-12-shared-number-proposal), second database only.
  await dropped.execute(
    sql.raw(
      `CREATE INDEX IF NOT EXISTS "patients_clinic_id_phone_idx" ON "patients" ("clinic_id", "phone")`,
    ),
  );
  await dropped.execute(sql.raw(`DROP INDEX IF EXISTS "patients_clinic_id_phone_index"`));
});

afterAll(async () => {
  for (const close of closers) await close();
});

async function patient(db: Database, clinic: TestClinic, fullName: string, ageDays: number) {
  const [row] = await db
    .insert(schema.patients)
    .values({
      clinicId: clinic.ctx.clinic.id,
      fullName,
      phone: PHONE,
      createdAt: new Date(Date.now() - ageDays * 86_400_000),
    })
    .returning();
  return row!;
}

async function call(db: Database, clinic: TestClinic, about?: string) {
  const [row] = await db
    .insert(schema.calls)
    .values({
      clinicId: clinic.ctx.clinic.id,
      provider: "retell",
      providerCallId: `cp-${Math.random()}`,
      fromNumber: PHONE,
    })
    .returning();
  if (about) {
    await db
      .insert(schema.callPatients)
      .values({ clinicId: clinic.ctx.clinic.id, callId: row!.id, patientId: about });
  }
  return row!;
}

describe("the patient shown for a call (P-12 step 1)", () => {
  it("today's schema, switch unset: the caller's patient, as before", async () => {
    const clinic = await createTestClinic(today);
    const ayse = await patient(today, clinic, "Ayşe Yılmaz", 2);
    const row = await call(today, clinic, ayse.id);
    const { rows, total } = await listCalls(today, clinic.ctx.clinic.id, { limit: 50, offset: 0 });
    expect(total).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ patientId: ayse.id, patientName: "Ayşe Yılmaz" });
    expect(await getCall(today, scopeFor(clinic.ctx), row.id)).toMatchObject({
      patientId: ayse.id,
    });
    // The switch changes nothing while a number has one patient.
    const on = await listCalls(today, clinic.ctx.clinic.id, { limit: 50, offset: 0 }, true);
    expect(on.rows).toEqual(rows);
  });

  it("two patients on one number: one row per call, never a duplicate", async () => {
    const clinic = await createTestClinic(dropped);
    const ayse = await patient(dropped, clinic, "Ayşe Yılmaz", 2);
    const mehmet = await patient(dropped, clinic, "Mehmet Yılmaz", 1);
    const aboutMehmet = await call(dropped, clinic, mehmet.id);
    await call(dropped, clinic);

    const off = await listCalls(dropped, clinic.ctx.clinic.id, { limit: 50, offset: 0 }, false);
    expect(off.rows).toHaveLength(2);
    expect(off.total).toBe(2);
    // Off: the oldest patient on the number, as the old join gave.
    expect(off.rows.every((r) => r.patientId === ayse.id)).toBe(true);

    const on = await listCalls(dropped, clinic.ctx.clinic.id, { limit: 50, offset: 0 }, true);
    expect(on.rows).toHaveLength(2);
    // On: the patient the call was about; a call about nobody falls back to the oldest.
    expect(on.rows.find((r) => r.id === aboutMehmet.id)?.patientName).toBe("Mehmet Yılmaz");
    expect(on.rows.find((r) => r.id !== aboutMehmet.id)?.patientName).toBe("Ayşe Yılmaz");

    const scope = scopeFor(clinic.ctx);
    expect((await getCall(dropped, scope, aboutMehmet.id, false))?.patientId).toBe(ayse.id);
    expect((await getCall(dropped, scope, aboutMehmet.id, true))?.patientId).toBe(mehmet.id);
  });
});

describe("the same number in two clinics (R2 5e review)", () => {
  it("each clinic's call list shows its own patient, never the other clinic's", async () => {
    const mine = await createTestClinic(today);
    const theirs = await createTestClinic(today);
    // The other clinic's record is older, so an unscoped "oldest" would pick it.
    await patient(today, theirs, "Başka Klinik Hasta", 5);
    const own = await patient(today, mine, "Kendi Hastam", 1);
    await call(today, mine);
    for (const perName of [false, true]) {
      const { rows } = await listCalls(
        today,
        mine.ctx.clinic.id,
        { limit: 50, offset: 0 },
        perName,
      );
      expect(rows[0]).toMatchObject({ patientId: own.id, patientName: "Kendi Hastam" });
    }
  });
});
