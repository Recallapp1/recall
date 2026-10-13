import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import type { Database } from "../db";
import { appointments } from "../db/schema";
import { bookAppointment } from "./appointments";
import { anonymizePatient } from "./panel";

/*
 * KVKK erasure and the booked-for name (full audit FA-01): the name of the
 * person a booking was for is personal data of the erased record and goes
 * with it. Run on today's schema and on the schema after migration 0020.
 */

const NOW = new Date("2026-10-04T09:00:00Z");

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

function book(
  db: Database,
  clinic: TestClinic,
  input: { time: string; patientName: string; phone: string; bookedForName?: string },
  patientsPerName: boolean,
) {
  return bookAppointment(db, clinic.ctx, {
    serviceId: clinic.serviceId,
    practitionerId: clinic.practitionerId,
    date: "2026-10-05",
    time: input.time,
    patientName: input.patientName,
    patientPhone: input.phone,
    bookedForName: input.bookedForName,
    source: "voice",
    patientsPerName,
    now: NOW,
  });
}

async function bookedFor(db: Database, appointmentId: string) {
  const [row] = await db
    .select({ name: appointments.bookedForName })
    .from(appointments)
    .where(eq(appointments.id, appointmentId));
  return row?.name;
}

const schemas = [
  ["today's schema", () => today],
  ["after migration 0020", () => dropped],
] as const;

describe.each(schemas)("erasure clears the booked-for name (%s)", (_, database) => {
  it("VOICE_SHARED_NUMBER_CHECK booking: the name goes with the erased record", async () => {
    const db = database();
    const clinic = await createTestClinic(db);
    const { appointment } = await book(
      db,
      clinic,
      {
        time: "10:00",
        patientName: "Deneme Veli",
        phone: "0532 000 00 41",
        bookedForName: "Deneme Veli",
      },
      false,
    );
    expect(await bookedFor(db, appointment.id)).toBe("Deneme Veli");

    await anonymizePatient(db, clinic.ctx.clinic.id, appointment.patientId, NOW);

    expect(await bookedFor(db, appointment.id)).toBeNull();
  });

  it("PATIENTS_PER_NAME: erasing one family member clears only their bookings", async () => {
    const db = database();
    const clinic = await createTestClinic(db);
    const parent = await book(
      db,
      clinic,
      { time: "10:00", patientName: "Deneme Veli", phone: "0532 000 00 42" },
      true,
    );
    const child = await book(
      db,
      clinic,
      { time: "11:00", patientName: "Deneme Cocuk", phone: "0532 000 00 42" },
      true,
    );
    const separateRecords = child.appointment.patientId !== parent.appointment.patientId;

    await anonymizePatient(db, clinic.ctx.clinic.id, parent.appointment.patientId, NOW);

    expect(await bookedFor(db, parent.appointment.id)).toBeNull();
    if (separateRecords) {
      // After 0020 the child has a record of their own: untouched.
      expect(child.appointment.patientId).not.toBe(parent.appointment.patientId);
      expect(await bookedFor(db, child.appointment.id)).toBe(child.appointment.bookedForName);
    } else {
      // Today the child's booking fell back to the parent's record, so it was
      // part of the erased record: its name goes too.
      expect(await bookedFor(db, child.appointment.id)).toBeNull();
    }
  });
});
