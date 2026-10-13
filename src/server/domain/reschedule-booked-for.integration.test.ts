import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import type { Database } from "../db";
import {
  bookAppointment,
  cancelAppointment,
  findUpcomingAppointments,
  isSharedNumber,
  rescheduleAppointment,
} from "./appointments";

/*
 * A move keeps who the booking was for (full audit FA-03): with
 * VOICE_SHARED_NUMBER_CHECK the family member's own name is what a caller
 * must give, before and after a reschedule. Run on today's schema and after
 * migration 0020.
 */

const NOW = new Date("2026-10-04T09:00:00Z");
const PHONE = "+905320000061";

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

function book(db: Database, clinic: TestClinic, time: string, name: string) {
  return bookAppointment(db, clinic.ctx, {
    serviceId: clinic.serviceId,
    practitionerId: clinic.practitionerId,
    date: "2026-10-05",
    time,
    patientName: name,
    patientPhone: PHONE,
    // As the voice tool does with VOICE_SHARED_NUMBER_CHECK on.
    bookedForName: name,
    source: "voice",
    now: NOW,
  });
}

const schemas = [
  ["today's schema", () => today],
  ["after migration 0020", () => dropped],
] as const;

describe.each(schemas)("reschedule keeps the booked-for name (%s)", (_, database) => {
  it("the moved appointment is still the family member's, and they can cancel it by name", async () => {
    const db = database();
    const clinic = await createTestClinic(db);
    await book(db, clinic, "10:00", "Deneme Veli");
    const { appointment: childs } = await book(db, clinic, "11:00", "Deneme Cocuk");

    const { appointment: moved } = await rescheduleAppointment(db, clinic.ctx, {
      appointmentId: childs.id,
      phone: PHONE,
      check: {
        patientName: "Deneme Cocuk",
        appointmentDate: "2026-10-05",
        appointmentTime: "11:00",
      },
      date: "2026-10-05",
      time: "14:00",
      now: NOW,
    });
    expect(moved.bookedForName).toBe("Deneme Cocuk");

    // Still a shared number after the move.
    expect(isSharedNumber(await findUpcomingAppointments(db, clinic.ctx, PHONE, NOW))).toBe(true);

    const cancelled = await cancelAppointment(db, clinic.ctx, {
      appointmentId: moved.id,
      phone: PHONE,
      check: {
        patientName: "Deneme Cocuk",
        appointmentDate: "2026-10-05",
        appointmentTime: "14:00",
      },
      now: NOW,
    });
    expect(cancelled.id).toBe(moved.id);
  });

  it("without a booked-for name nothing changes", async () => {
    const db = database();
    const clinic = await createTestClinic(db);
    const { appointment } = await bookAppointment(db, clinic.ctx, {
      serviceId: clinic.serviceId,
      practitionerId: clinic.practitionerId,
      date: "2026-10-05",
      time: "10:00",
      patientName: "Deneme Tek",
      patientPhone: "+905320000062",
      source: "voice",
      now: NOW,
    });
    const { appointment: moved } = await rescheduleAppointment(db, clinic.ctx, {
      appointmentId: appointment.id,
      phone: "+905320000062",
      date: "2026-10-05",
      time: "15:00",
      now: NOW,
    });
    expect(moved.bookedForName).toBeNull();
  });
});
