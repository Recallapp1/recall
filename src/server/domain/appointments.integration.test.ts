import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import type { Database } from "../db";
import { appointments, patients, practitioners, services } from "../db/schema";
import {
  bookAppointment,
  cancelAppointment,
  findUpcomingAppointments,
  rescheduleAppointment,
  sameFullName,
} from "./appointments";
import { DomainError } from "./errors";
import { findAvailability } from "./scheduling";

// Sunday 2026-10-04 12:00 Istanbul; the next day is Monday 2026-10-05.
const NOW = new Date("2026-10-04T09:00:00Z");
const MONDAY = "2026-10-05";
const CALLER = "+905320000025";

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

function book(clinic: TestClinic, overrides: Partial<Parameters<typeof bookAppointment>[2]> = {}) {
  return bookAppointment(db, clinic.ctx, {
    serviceId: clinic.serviceId,
    practitionerId: clinic.practitionerId,
    date: MONDAY,
    time: "10:00",
    patientName: "Ayşe Yılmaz",
    patientPhone: CALLER,
    source: "voice",
    now: NOW,
    ...overrides,
  });
}

async function expectDomainError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(DomainError);
  await expect(promise).rejects.toMatchObject({ code });
}

describe("sameFullName", () => {
  it("tolerates case, Turkish letters, punctuation and word order", () => {
    expect(sameFullName("Zeynep Şahin", "zeynep sahin")).toBe(true);
    expect(sameFullName("İsmail Işık", "ismail isik")).toBe(true);
    expect(sameFullName("Ayşe Nur Öztürk", "Öztürk, Ayşe Nur")).toBe(true);
  });

  it("tolerates typical Turkish speech-recognition slips in a word", () => {
    expect(sameFullName("Deneme Test", "Deneme Tez")).toBe(true);
    expect(sameFullName("Mehmet Doğan", "Mehmet Toğan")).toBe(true);
    expect(sameFullName("Hatice Çelik", "Hatice Celil")).toBe(true);
  });

  it("requires every word to match", () => {
    expect(sameFullName("Zeynep Şahin", "Zeynep")).toBe(false);
    expect(sameFullName("Zeynep Şahin", "Zeynep Şahin Kaya")).toBe(false);
    expect(sameFullName("Zeynep Şahin", "Zehra Şahin")).toBe(false);
    expect(sameFullName("Deneme Test", "De Mehmet Öz")).toBe(false);
    expect(sameFullName("Can Ak", "Cem Ak")).toBe(false);
    expect(sameFullName("", "")).toBe(false);
  });
});

describe("bookAppointment", () => {
  it("creates the patient and appointment in clinic-local time", async () => {
    const clinic = await createTestClinic(db);
    const { appointment, created } = await book(clinic);

    expect(created).toBe(true);
    expect(appointment).toMatchObject({
      date: MONDAY,
      time: "10:00",
      serviceName: "Muayene",
      practitionerName: "Dt. Can Demir",
      patientPhone: CALLER,
    });
    expect(appointment.startsAt.toISOString()).toBe("2026-10-05T07:00:00.000Z");
  });

  it("is idempotent for a retried tool call", async () => {
    const clinic = await createTestClinic(db);
    const first = await book(clinic);
    const second = await book(clinic);

    expect(second.created).toBe(false);
    expect(second.appointment.id).toBe(first.appointment.id);
  });

  it("removes a booked slot from availability", async () => {
    const clinic = await createTestClinic(db);
    await book(clinic);
    const { slots } = await findAvailability(db, clinic.ctx, {
      serviceId: clinic.serviceId,
      date: MONDAY,
      now: NOW,
    });
    expect(slots.map((s) => s.time)).not.toContain("10:00");
    expect(slots.map((s) => s.time)).toContain("10:30");
  });

  it("rejects a slot that another caller already holds", async () => {
    const clinic = await createTestClinic(db);
    await book(clinic);
    await expectDomainError(
      book(clinic, { patientName: "Mehmet Kaya", patientPhone: "+905320000021" }),
      "SLOT_UNAVAILABLE",
    );
  });

  it("refuses a second voice booking that overlaps the caller's own appointment", async () => {
    const clinic = await createTestClinic(db);
    // A second practitioner and service, so the slot itself is free.
    const [other] = await db
      .insert(practitioners)
      .values({ clinicId: clinic.ctx.clinic.id, name: "Elif Kaya", title: "Dt." })
      .returning();
    const [extraction] = await db
      .insert(services)
      .values({ clinicId: clinic.ctx.clinic.id, name: "Diş Çekimi", durationMinutes: 30 })
      .returning();
    await book(clinic, { time: "10:00" });

    // Seen live: "sekiz Ekim" heard as "çekim" → a second booking in the same slot.
    await expectDomainError(
      book(clinic, { time: "10:00", practitionerId: other!.id, serviceId: extraction!.id }),
      "PATIENT_BUSY",
    );
    // A retried call for the same booking is still idempotent, not refused.
    const retry = await book(clinic, { time: "10:00" });
    expect(retry.created).toBe(false);
    // Another time is fine, and staff booking from the panel keep full control.
    const later = await book(clinic, {
      time: "11:00",
      practitionerId: other!.id,
      serviceId: extraction!.id,
    });
    expect(later.created).toBe(true);
    const staff = await book(clinic, {
      time: "10:00",
      practitionerId: other!.id,
      serviceId: extraction!.id,
      source: "panel",
    });
    expect(staff.created).toBe(true);
  });

  it("requires a phone number when caller ID is withheld", async () => {
    const clinic = await createTestClinic(db);
    await expectDomainError(book(clinic, { patientPhone: null }), "PHONE_REQUIRED");
  });

  it("asks again for a number with a missing digit", async () => {
    const clinic = await createTestClinic(db);
    // Seen live: the model read "0532 000 00 22" back correctly but sent ten digits.
    await expectDomainError(book(clinic, { patientPhone: "0532000002" }), "INVALID_PHONE");
  });

  it("accepts the number in spoken groups", async () => {
    const clinic = await createTestClinic(db);
    const { created } = await book(clinic, { patientPhone: "0532 000 00 25" });
    expect(created).toBe(true);
  });

  it("rejects services from another clinic", async () => {
    const clinicA = await createTestClinic(db);
    const clinicB = await createTestClinic(db);
    await expectDomainError(book(clinicA, { serviceId: clinicB.serviceId }), "INVALID_SERVICE");
  });
});

describe("overlap exclusion constraint", () => {
  it("blocks overlapping active appointments at the database level", async () => {
    const clinic = await createTestClinic(db);
    const [patient] = await db
      .insert(patients)
      .values({ clinicId: clinic.ctx.clinic.id, fullName: "Test", phone: "+905000000001" })
      .returning();
    const base = {
      clinicId: clinic.ctx.clinic.id,
      patientId: patient.id,
      practitionerId: clinic.practitionerId,
      serviceId: clinic.serviceId,
      source: "panel" as const,
    };

    await db.insert(appointments).values({
      ...base,
      startsAt: new Date("2026-10-05T07:00:00Z"),
      endsAt: new Date("2026-10-05T07:30:00Z"),
    });
    await expect(
      db.insert(appointments).values({
        ...base,
        startsAt: new Date("2026-10-05T07:15:00Z"),
        endsAt: new Date("2026-10-05T07:45:00Z"),
      }),
    ).rejects.toThrow();

    // Cancelled appointments do not hold the slot.
    await db.insert(appointments).values({
      ...base,
      status: "cancelled",
      startsAt: new Date("2026-10-05T07:15:00Z"),
      endsAt: new Date("2026-10-05T07:45:00Z"),
    });
  });
});

describe("cancel and reschedule", () => {
  it("finds and cancels only the caller's own appointment", async () => {
    const clinic = await createTestClinic(db);
    const { appointment } = await book(clinic);

    const upcoming = await findUpcomingAppointments(db, clinic.ctx, CALLER, NOW);
    expect(upcoming.map((a) => a.id)).toEqual([appointment.id]);

    await expectDomainError(
      cancelAppointment(db, clinic.ctx, {
        appointmentId: appointment.id,
        phone: "+905320000021",
        now: NOW,
      }),
      "NOT_FOUND",
    );

    await cancelAppointment(db, clinic.ctx, {
      appointmentId: appointment.id,
      phone: CALLER,
      now: NOW,
    });
    expect(await findUpcomingAppointments(db, clinic.ctx, CALLER, NOW)).toEqual([]);
  });

  it("never lets one clinic touch another clinic's appointment", async () => {
    const clinicA = await createTestClinic(db);
    const clinicB = await createTestClinic(db);
    const { appointment } = await book(clinicA);

    await expectDomainError(
      cancelAppointment(db, clinicB.ctx, {
        appointmentId: appointment.id,
        phone: CALLER,
        now: NOW,
      }),
      "NOT_FOUND",
    );
    expect(await findUpcomingAppointments(db, clinicB.ctx, CALLER, NOW)).toEqual([]);
  });

  it("enforces the clinic's cancellation notice", async () => {
    const clinic = await createTestClinic(db, {
      settings: { booking: { minNoticeMinutes: 0, cancellationMinNoticeHours: 48 } },
    });
    const { appointment } = await book(clinic);
    await expectDomainError(
      cancelAppointment(db, clinic.ctx, { appointmentId: appointment.id, phone: CALLER, now: NOW }),
      "TOO_LATE_TO_CANCEL",
    );
  });

  it("moves an appointment to a new slot", async () => {
    const clinic = await createTestClinic(db);
    const { appointment } = await book(clinic);

    const { previous, appointment: moved } = await rescheduleAppointment(db, clinic.ctx, {
      appointmentId: appointment.id,
      phone: CALLER,
      date: MONDAY,
      time: "10:30",
      now: NOW,
    });
    expect(previous.time).toBe("10:00");
    expect(moved.time).toBe("10:30");

    const upcoming = await findUpcomingAppointments(db, clinic.ctx, CALLER, NOW);
    expect(upcoming.map((a) => a.time)).toEqual(["10:30"]);
  });

  it("keeps the original appointment when the new slot is taken", async () => {
    const clinic = await createTestClinic(db);
    const { appointment } = await book(clinic);
    await book(clinic, {
      time: "11:00",
      patientName: "Mehmet Kaya",
      patientPhone: "+905320000021",
    });

    await expectDomainError(
      rescheduleAppointment(db, clinic.ctx, {
        appointmentId: appointment.id,
        phone: CALLER,
        date: MONDAY,
        time: "11:00",
        now: NOW,
      }),
      "SLOT_UNAVAILABLE",
    );
    const upcoming = await findUpcomingAppointments(db, clinic.ctx, CALLER, NOW);
    expect(upcoming.map((a) => a.time)).toEqual(["10:00"]);
  });
});
