import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import type { Database } from "../db";
import { ACTIVE_APPOINTMENT_STATUSES, appointments, practitioners, timeOff } from "../db/schema";
import { bookAppointment, cancelAppointment, rescheduleAppointment } from "./appointments";
import { findAvailability } from "./scheduling";
import { localToUtc } from "./time";

/*
 * R2 4b: many simultaneous bookings for one slot, cancel and reschedule races.
 * R2 4c: holidays, practitioner leave, the last slot of the day.
 */

// Sunday 2026-10-04 12:00 Istanbul; the next day is Monday 2026-10-05.
const NOW = new Date("2026-10-04T09:00:00Z");
const MONDAY = "2026-10-05";

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

const phone = (n: number) => `+9053200001${String(n).padStart(2, "0")}`;

function book(clinic: TestClinic, time: string, n: number, practitionerId = clinic.practitionerId) {
  return bookAppointment(db, clinic.ctx, {
    serviceId: clinic.serviceId,
    practitionerId,
    date: MONDAY,
    time,
    patientName: `Hasta ${n}`,
    patientPhone: phone(n),
    source: "panel",
    now: NOW,
  });
}

async function activeAt(clinic: TestClinic, time: string) {
  const minute = Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  return db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.clinicId, clinic.ctx.clinic.id),
        eq(appointments.startsAt, localToUtc(MONDAY, minute, clinic.ctx.clinic.timezone)),
        inArray(appointments.status, [...ACTIVE_APPOINTMENT_STATUSES]),
      ),
    );
}

describe("races (R2 4b)", () => {
  it("eight simultaneous bookings for one slot: exactly one wins", async () => {
    const clinic = await createTestClinic(db);
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) => book(clinic, "10:00", i)),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results.filter((r) => r.status === "rejected")) {
      expect((r as PromiseRejectedResult).reason).toMatchObject({ code: "SLOT_UNAVAILABLE" });
    }
    expect(await activeAt(clinic, "10:00")).toHaveLength(1);
  });

  it("two simultaneous cancellations: both answer, the appointment is cancelled once", async () => {
    const clinic = await createTestClinic(db);
    const { appointment } = await book(clinic, "11:00", 20);
    const results = await Promise.all(
      [0, 1].map(() =>
        cancelAppointment(db, clinic.ctx, {
          appointmentId: appointment.id,
          phone: phone(20),
          now: NOW,
        }),
      ),
    );
    expect(results).toHaveLength(2);
    const [row] = await db.select().from(appointments).where(eq(appointments.id, appointment.id));
    expect(row!.status).toBe("cancelled");
  });

  it("a move and a new booking race for the same free slot: only one gets it", async () => {
    const clinic = await createTestClinic(db);
    const { appointment } = await book(clinic, "12:00", 30);
    const results = await Promise.allSettled([
      rescheduleAppointment(db, clinic.ctx, {
        appointmentId: appointment.id,
        phone: phone(30),
        date: MONDAY,
        time: "13:00",
        now: NOW,
      }),
      book(clinic, "13:00", 31),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await activeAt(clinic, "13:00")).toHaveLength(1);
  });

  it("a move and a cancellation of the same appointment: never two active appointments", async () => {
    const clinic = await createTestClinic(db);
    const { appointment } = await book(clinic, "14:00", 40);
    await Promise.allSettled([
      rescheduleAppointment(db, clinic.ctx, {
        appointmentId: appointment.id,
        phone: phone(40),
        date: MONDAY,
        time: "15:00",
        now: NOW,
      }),
      cancelAppointment(db, clinic.ctx, {
        appointmentId: appointment.id,
        phone: phone(40),
        now: NOW,
      }),
    ]);
    const active = [...(await activeAt(clinic, "14:00")), ...(await activeAt(clinic, "15:00"))];
    expect(active.length).toBeLessThanOrEqual(1);
  });
});

describe("calendar edges (R2 4c)", () => {
  it("a clinic-wide holiday closes the day for availability and booking", async () => {
    const clinic = await createTestClinic(db);
    const tz = clinic.ctx.clinic.timezone;
    await db.insert(timeOff).values({
      clinicId: clinic.ctx.clinic.id,
      practitionerId: null,
      startsAt: localToUtc(MONDAY, 0, tz),
      endsAt: localToUtc("2026-10-06", 0, tz),
      reason: "Resmî tatil",
    });
    const availability = await findAvailability(db, clinic.ctx, {
      serviceId: clinic.serviceId,
      date: MONDAY,
      now: NOW,
    });
    expect(availability.slots).toEqual([]);
    await expect(book(clinic, "10:00", 50)).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
  });

  it("a practitioner's leave blocks only that practitioner", async () => {
    const clinic = await createTestClinic(db);
    const tz = clinic.ctx.clinic.timezone;
    const [second] = await db
      .insert(practitioners)
      .values({ clinicId: clinic.ctx.clinic.id, name: "Elif Kaya", title: "Dt." })
      .returning();
    await db.insert(timeOff).values({
      clinicId: clinic.ctx.clinic.id,
      practitionerId: clinic.practitionerId,
      startsAt: localToUtc(MONDAY, 0, tz),
      endsAt: localToUtc("2026-10-06", 0, tz),
      reason: "İzin",
    });
    await expect(book(clinic, "10:00", 60)).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
    await expect(book(clinic, "10:00", 61, second!.id)).resolves.toMatchObject({ created: true });
  });

  it("the last slot that fits before closing is bookable; one minute later is not offered", async () => {
    const clinic = await createTestClinic(db);
    await expect(book(clinic, "16:30", 70)).resolves.toMatchObject({ created: true });
    await expect(book(clinic, "16:31", 71)).rejects.toBeDefined();
  });
});
