import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import type { Database } from "../db";
import { appointments, clinics } from "../db/schema";
import { bookAppointment, cancelAppointment, rescheduleAppointment } from "./appointments";
import { parseClinicSettings } from "./clinic-settings";
import { changeAppointmentStatus, scopeFor } from "./panel";
import { setClinicLimits, updateAssistantSettings } from "./settings";

/*
 * Simultaneous changes (full audit FA-17, FA-23): a change made from a stale
 * read must not overwrite another change, and two settings saves must both
 * survive. PGlite runs on one connection, so two read-then-write sequences
 * started together interleave like two requests would.
 */

const NOW = new Date("2026-10-04T09:00:00Z");
const ACTIVE = ["scheduled", "confirmed"] as const;

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

async function booked(clinic: TestClinic, time: string, phone: string) {
  const { appointment } = await bookAppointment(db, clinic.ctx, {
    serviceId: clinic.serviceId,
    practitionerId: clinic.practitionerId,
    date: "2026-10-05",
    time,
    patientName: "Eşzamanlı Deneme",
    patientPhone: phone,
    source: "voice",
    now: NOW,
  });
  return appointment;
}

describe("simultaneous appointment changes", () => {
  it("a voice cancellation and a staff 'completed' at once: one wins, the other is refused", async () => {
    const clinic = await createTestClinic(db);
    const appointment = await booked(clinic, "10:00", "+905320000091");

    const results = await Promise.allSettled([
      cancelAppointment(db, clinic.ctx, {
        appointmentId: appointment.id,
        phone: "+905320000091",
        now: NOW,
      }),
      changeAppointmentStatus(db, scopeFor(clinic.ctx), {
        appointmentId: appointment.id,
        status: "completed",
        now: NOW,
      }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    expect(fulfilled).toHaveLength(1);
    const [row] = await db.select().from(appointments).where(eq(appointments.id, appointment.id));
    // The stored status is the winner's, never a silent overwrite of it.
    expect(["cancelled", "completed"]).toContain(row!.status);
  });

  it("two reschedules of one appointment at once never leave two active appointments", async () => {
    const clinic = await createTestClinic(db);
    const appointment = await booked(clinic, "10:00", "+905320000092");

    await Promise.allSettled([
      rescheduleAppointment(db, clinic.ctx, {
        appointmentId: appointment.id,
        phone: "+905320000092",
        date: "2026-10-05",
        time: "13:00",
        now: NOW,
      }),
      rescheduleAppointment(db, clinic.ctx, {
        appointmentId: appointment.id,
        phone: "+905320000092",
        date: "2026-10-05",
        time: "15:00",
        now: NOW,
      }),
    ]);

    const active = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.patientId, appointment.patientId),
          inArray(appointments.status, [...ACTIVE]),
        ),
      );
    expect(active).toHaveLength(1);
  });
});

describe("simultaneous settings saves", () => {
  it("an assistant save and a limits save at once both survive", async () => {
    const clinic = await createTestClinic(db);
    await Promise.all([
      updateAssistantSettings(db, clinic.ctx.clinic.id, {
        name: "Eşzamanlı",
        greeting: null,
        speakPrices: false,
        recordCalls: true,
        extraInstructions: null,
        faq: [],
      }),
      setClinicLimits(db, clinic.ctx.clinic.id, {
        ...parseClinicSettings({}).limits,
        dailyVoiceMinutes: 777,
      }),
    ]);
    const [row] = await db
      .select({ settings: clinics.settings })
      .from(clinics)
      .where(eq(clinics.id, clinic.ctx.clinic.id));
    const settings = parseClinicSettings(row!.settings);
    expect(settings.assistant.name).toBe("Eşzamanlı");
    expect(settings.limits.dailyVoiceMinutes).toBe(777);
  });
});
