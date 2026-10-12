import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import type { Database } from "../db";
import { appointments, patients } from "../db/schema";
import { bookAppointment } from "./appointments";
import { enqueueAppointmentMessage } from "./notifications";
import { getAppointment, listAppointments, scopeFor } from "./panel";
import { patientsPerName } from "./patients-per-name";

// Sunday 2026-10-04 12:00 Istanbul; the next day is Monday 2026-10-05.
const NOW = new Date("2026-10-04T09:00:00Z");
const MONDAY = "2026-10-05";
const PHONE = "+905320000071";
// pnpm test:p12-rehearsal runs the suite on the schema without the unique
// index; these tests observe the fallback that only that index produces.
const rehearsal = process.env.TEST_SCHEMA === "p12-dropped";

let today: Database; // today's schema: unique (clinic_id, phone)
let dropped: Database; // after the proposed migration 0020
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
  ["after migration 0020", () => dropped],
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
  it.skipIf(rehearsal)(
    "today's schema: a family member's booking falls back to the number's patient (no error)",
    async () => {
      const clinic = await createTestClinic(today);
      await book(today, clinic, "10:00", "Ayşe Yılmaz", true);
      const second = await book(today, clinic, "11:00", "Mehmet Yılmaz", true);
      const rows = await onNumber(today, clinic);
      expect(rows).toHaveLength(1);
      expect(second.created).toBe(true);
      expect(second.appointment.patientId).toBe(rows[0]!.id);
    },
  );

  it("after migration 0020: a family member gets their own record", async () => {
    const clinic = await createTestClinic(dropped);
    const a = await book(dropped, clinic, "10:00", "Ayşe Yılmaz", true);
    const b = await book(dropped, clinic, "11:00", "Mehmet Yılmaz", true);
    const rows = await onNumber(dropped, clinic);
    expect(rows.map((r) => r.fullName)).toEqual(["Ayşe Yılmaz", "Mehmet Yılmaz"]);
    expect(a.appointment.patientId).toBe(rows[0]!.id);
    expect(b.appointment.patientId).toBe(rows[1]!.id);
    expect(b.appointment.patientName).toBe("Mehmet Yılmaz");
  });

  it("after migration 0020: the same person (speech-tolerant name) keeps one record", async () => {
    const clinic = await createTestClinic(dropped);
    await book(dropped, clinic, "10:00", "Ayşe Yılmaz", true);
    const again = await book(dropped, clinic, "11:00", "ayse yilmaz", true);
    const rows = await onNumber(dropped, clinic);
    expect(rows).toHaveLength(1);
    expect(again.appointment.patientId).toBe(rows[0]!.id);
  });

  it("after migration 0020, switched off again: bookings go to the oldest record on the number", async () => {
    const clinic = await createTestClinic(dropped);
    await book(dropped, clinic, "10:00", "Ayşe Yılmaz", true);
    await book(dropped, clinic, "11:00", "Mehmet Yılmaz", true);
    const third = await book(dropped, clinic, "12:00", "Mehmet Yılmaz");
    const rows = await onNumber(dropped, clinic);
    expect(rows).toHaveLength(2);
    expect(third.appointment.patientId).toBe(rows[0]!.id);
  });
});

async function bookedFor(db: Database, appointmentId: string) {
  const [row] = await db
    .select({ bookedForName: appointments.bookedForName })
    .from(appointments)
    .where(sql`${appointments.id} = ${appointmentId}`);
  return row!.bookedForName;
}

function switchEnv(on: boolean) {
  // A minimal valid environment, so the default is read through env().
  process.env.APP_URL = "http://localhost:3000";
  process.env.DATABASE_URL = "postgres://test@localhost/test";
  if (on) process.env.PATIENTS_PER_NAME = "true";
  else delete process.env.PATIENTS_PER_NAME;
}

describe("finding family members by name (P-12 step 1)", () => {
  it.skipIf(rehearsal)(
    "today's schema: a fallback booking keeps the family member's name on the appointment",
    async () => {
      const clinic = await createTestClinic(today);
      await book(today, clinic, "10:00", "Ayşe Yılmaz", true);
      const mehmet = await book(today, clinic, "11:00", "Mehmet Yılmaz", true);
      expect(await bookedFor(today, mehmet.appointment.id)).toBe("Mehmet Yılmaz");
      // Switch unset: nothing recorded, as before.
      const unset = await book(today, clinic, "12:00", "Zeynep Yılmaz");
      expect(await bookedFor(today, unset.appointment.id)).toBeNull();
    },
  );

  it.skipIf(rehearsal)(
    "the appointment search matches who a booking was for only with the switch",
    async () => {
      const clinic = await createTestClinic(today);
      await book(today, clinic, "10:00", "Ayşe Yılmaz", true);
      await book(today, clinic, "11:00", "Mehmet Yılmaz", true);
      const search = (perName: boolean) =>
        listAppointments(
          today,
          scopeFor(clinic.ctx),
          { from: MONDAY, to: "2026-10-06", search: "Mehmet" },
          { perName },
        );
      expect((await search(false)).rows).toHaveLength(0);
      const on = await search(true);
      expect(on.rows).toHaveLength(1);
      expect(on.total).toBe(1);
    },
  );
});

describe("SMS opt-out on a shared number (P-12 step 1)", () => {
  it("follows the number only with the switch; unset keeps the patient's own flag", async () => {
    const clinic = await createTestClinic(dropped);
    await book(dropped, clinic, "10:00", "Ayşe Yılmaz", true);
    const mehmet = await book(dropped, clinic, "11:00", "Mehmet Yılmaz", true);
    await dropped.execute(
      sql`update patients set sms_opt_out_at = now()
          where clinic_id = ${clinic.ctx.clinic.id} and full_name = 'Ayşe Yılmaz'`,
    );
    const enqueue = (kind: "appointment_confirmation" | "appointment_rescheduled") =>
      enqueueAppointmentMessage(dropped, {
        clinicId: clinic.ctx.clinic.id,
        kind,
        appointmentId: mehmet.appointment.id,
        patientId: mehmet.appointment.patientId,
        now: NOW,
      });

    switchEnv(false);
    expect((await enqueue("appointment_confirmation")).optedOut).toBe(false);
    switchEnv(true);
    expect((await enqueue("appointment_rescheduled")).optedOut).toBe(true);
  });
});

describe("booked-for name in the panel (P-12 step 2)", () => {
  it.skipIf(rehearsal)(
    "shows who a booking was for only with the switch, and only when it differs",
    async () => {
      const clinic = await createTestClinic(today);
      await book(today, clinic, "10:00", "Ayşe Yılmaz", true);
      const mehmet = await book(today, clinic, "11:00", "Mehmet Yılmaz", true);
      const scope = scopeFor(clinic.ctx);
      const list = () =>
        listAppointments(today, scope, { from: MONDAY, to: "2026-10-06" }, { perName: false });

      switchEnv(false);
      expect((await getAppointment(today, scope, mehmet.appointment.id))?.bookedForName).toBeNull();
      expect((await list()).rows.every((row) => row.bookedForName === null)).toBe(true);

      switchEnv(true);
      const detail = await getAppointment(today, scope, mehmet.appointment.id);
      expect(detail).toMatchObject({ patientName: "Ayşe Yılmaz", bookedForName: "Mehmet Yılmaz" });
      const rows = (await list()).rows;
      expect(rows.find((row) => row.id === mehmet.appointment.id)?.bookedForName).toBe(
        "Mehmet Yılmaz",
      );
      // Ayşe's own booking: no booked-for name to show.
      expect(rows.find((row) => row.id !== mehmet.appointment.id)?.bookedForName).toBeNull();
    },
  );

  it("hides a booked-for name that is the patient's own (speech-tolerant)", async () => {
    const clinic = await createTestClinic(today);
    const first = await bookAppointment(today, clinic.ctx, {
      serviceId: clinic.serviceId,
      practitionerId: clinic.practitionerId,
      date: MONDAY,
      time: "12:00",
      patientName: "Ayşe Yılmaz",
      patientPhone: PHONE,
      bookedForName: "ayse yilmaz",
      source: "voice",
      now: NOW,
    });
    switchEnv(true);
    const detail = await getAppointment(today, scopeFor(clinic.ctx), first.appointment.id);
    expect(detail?.bookedForName).toBeNull();
  });
});
