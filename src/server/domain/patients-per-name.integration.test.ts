import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import type { Database } from "../db";
import { patients } from "../db/schema";
import { bookAppointment } from "./appointments";
import { patientsPerName } from "./patients-per-name";

// Sunday 2026-10-04 12:00 Istanbul; the next day is Monday 2026-10-05.
const NOW = new Date("2026-10-04T09:00:00Z");
const MONDAY = "2026-10-05";
const PHONE = "+905320000071";

let today: Database; // today's schema: unique (clinic_id, phone)
let dropped: Database; // after the proposed migration 0019
const closers: (() => Promise<void>)[] = [];

beforeAll(async () => {
  const a = await createTestDb();
  const b = await createTestDb();
  today = a.db;
  dropped = b.db;
  closers.push(a.close, b.close);
  // docs/proposals/P-12-shared-number/up.sql, applied to the second database only.
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

const savedEnv = { ...process.env };
afterEach(() => {
  process.env = { ...savedEnv };
});

function book(
  db: Database,
  clinic: TestClinic,
  time: string,
  patientName: string,
  perName?: boolean,
) {
  return bookAppointment(db, clinic.ctx, {
    serviceId: clinic.serviceId,
    practitionerId: clinic.practitionerId,
    date: MONDAY,
    time,
    patientName,
    patientPhone: PHONE,
    source: "panel",
    now: NOW,
    ...(perName !== undefined && { patientsPerName: perName }),
  });
}

async function onNumber(db: Database, clinic: TestClinic) {
  const rows = await db
    .select({ id: patients.id, fullName: patients.fullName, updatedAt: patients.updatedAt })
    .from(patients)
    .where(sql`${patients.clinicId} = ${clinic.ctx.clinic.id} and ${patients.phone} = ${PHONE}`)
    .orderBy(patients.createdAt);
  return rows;
}

describe("PATIENTS_PER_NAME switch (P-12 step 1)", () => {
  it("is off when unset, and only the exact string true turns it on", () => {
    // A minimal valid environment, so the switch is read through env().
    process.env.APP_URL = "http://localhost:3000";
    process.env.DATABASE_URL = "postgres://test@localhost/test";
    delete process.env.PATIENTS_PER_NAME;
    expect(patientsPerName()).toBe(false);
    process.env.PATIENTS_PER_NAME = "false";
    expect(patientsPerName()).toBe(false);
    process.env.PATIENTS_PER_NAME = "true";
    expect(patientsPerName()).toBe(true);
  });
});

describe.each([
  ["today's schema", () => today],
  ["after migration 0019", () => dropped],
])("switch unset, %s: unchanged behaviour (one patient per number)", (_, database) => {
  it("files a second name on the number under the first patient and keeps its name", async () => {
    const db = database();
    const clinic = await createTestClinic(db);
    const first = await book(db, clinic, "10:00", "Ayşe Yılmaz");
    const [before] = await onNumber(db, clinic);
    const second = await book(db, clinic, "11:00", "Mehmet Yılmaz");
    const rows = await onNumber(db, clinic);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.fullName).toBe("Ayşe Yılmaz");
    expect(first.appointment.patientId).toBe(rows[0]!.id);
    expect(second.appointment.patientId).toBe(rows[0]!.id);
    // As the old ON CONFLICT … DO UPDATE SET updated_at = now() did.
    expect(rows[0]!.updatedAt.getTime()).toBeGreaterThanOrEqual(before!.updatedAt.getTime());
  });

  it("creates one patient for a new number, even with two bookings at once", async () => {
    const db = database();
    const clinic = await createTestClinic(db);
    const results = await Promise.all([
      book(db, clinic, "13:00", "Zeynep Kaya"),
      book(db, clinic, "14:00", "Zeynep Kaya"),
    ]);
    const rows = await onNumber(db, clinic);
    expect(rows).toHaveLength(1);
    expect(new Set(results.map((r) => r.appointment.patientId))).toEqual(new Set([rows[0]!.id]));
  });
});

describe("switch on", () => {
  it("today's schema: a family member's booking falls back to the number's patient (no error)", async () => {
    const clinic = await createTestClinic(today);
    await book(today, clinic, "10:00", "Ayşe Yılmaz", true);
    const second = await book(today, clinic, "11:00", "Mehmet Yılmaz", true);
    const rows = await onNumber(today, clinic);
    expect(rows).toHaveLength(1);
    expect(second.created).toBe(true);
    expect(second.appointment.patientId).toBe(rows[0]!.id);
  });

  it("after migration 0019: a family member gets their own record", async () => {
    const clinic = await createTestClinic(dropped);
    const a = await book(dropped, clinic, "10:00", "Ayşe Yılmaz", true);
    const b = await book(dropped, clinic, "11:00", "Mehmet Yılmaz", true);
    const rows = await onNumber(dropped, clinic);
    expect(rows.map((r) => r.fullName)).toEqual(["Ayşe Yılmaz", "Mehmet Yılmaz"]);
    expect(a.appointment.patientId).toBe(rows[0]!.id);
    expect(b.appointment.patientId).toBe(rows[1]!.id);
    expect(b.appointment.patientName).toBe("Mehmet Yılmaz");
  });

  it("after migration 0019: the same person (speech-tolerant name) keeps one record", async () => {
    const clinic = await createTestClinic(dropped);
    await book(dropped, clinic, "10:00", "Ayşe Yılmaz", true);
    const again = await book(dropped, clinic, "11:00", "ayse yilmaz", true);
    const rows = await onNumber(dropped, clinic);
    expect(rows).toHaveLength(1);
    expect(again.appointment.patientId).toBe(rows[0]!.id);
  });

  it("after migration 0019, switched off again: bookings go to the oldest record on the number", async () => {
    const clinic = await createTestClinic(dropped);
    await book(dropped, clinic, "10:00", "Ayşe Yılmaz", true);
    await book(dropped, clinic, "11:00", "Mehmet Yılmaz", true);
    const third = await book(dropped, clinic, "12:00", "Mehmet Yılmaz");
    const rows = await onNumber(dropped, clinic);
    expect(rows).toHaveLength(2);
    expect(third.appointment.patientId).toBe(rows[0]!.id);
  });
});
