import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb } from "@/test/db";

import type { Database } from "../db";
import { callbackRequests, notifications } from "../db/schema";
import { bookAppointment } from "./appointments";
import { parseClinicSettings } from "./clinic-settings";
import { dispatchNotifications, enqueueAppointmentMessage } from "./notifications";
import { openCallbacksNearingDeletion } from "./retention";

/*
 * Full audit FA-19: a booking message queued outside the send window must not
 * go out after the appointment has started. FA-18: open callback notes about
 * to reach their 90-day deletion are reported, so a request is not lost unseen.
 */

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

describe("transactional SMS after the appointment started", () => {
  it("is skipped as too late instead of being sent", async () => {
    const clinic = await createTestClinic(db);
    // Booked on Sunday 21:30 Istanbul (outside the send window) for Monday 09:00.
    const bookedAt = new Date("2026-10-04T18:30:00Z");
    const { appointment } = await bookAppointment(db, clinic.ctx, {
      serviceId: clinic.serviceId,
      practitionerId: clinic.practitionerId,
      date: "2026-10-05",
      time: "09:00",
      patientName: "Geç Mesaj",
      patientPhone: "+905320000093",
      source: "voice",
      now: bookedAt,
    });
    await enqueueAppointmentMessage(db, {
      clinicId: clinic.ctx.clinic.id,
      kind: "appointment_confirmation",
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      now: bookedAt,
    });

    const sent: string[] = [];
    // Monday 10:00 Istanbul: the window is open, the appointment began at 09:00.
    await dispatchNotifications(
      db,
      {
        id: clinic.ctx.clinic.id,
        name: clinic.ctx.clinic.name,
        timezone: clinic.ctx.clinic.timezone,
        settings: parseClinicSettings(clinic.ctx.clinic.settings),
      },
      {
        now: new Date("2026-10-05T07:00:00Z"),
        sendingEnabled: true,
        provider: { delivers: true, send: async (to) => void sent.push(to) },
        providerName: "test",
      },
    );

    expect(sent).toEqual([]);
    const [row] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.subjectId, appointment.id));
    expect(row).toMatchObject({ status: "skipped", skipReason: "too_late" });
  });
});

describe("open callback notes near their deletion", () => {
  it("counts open notes older than 80 days per clinic; done and newer notes do not count", async () => {
    const clinic = await createTestClinic(db);
    const other = await createTestClinic(db);
    const now = new Date("2026-10-14T03:30:00Z");
    const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const note = (clinicId: string, createdAt: Date, status: "open" | "done") =>
      db.insert(callbackRequests).values({ clinicId, reason: "Geri arayın", status, createdAt });
    await note(clinic.ctx.clinic.id, daysAgo(85), "open");
    await note(clinic.ctx.clinic.id, daysAgo(81), "open");
    await note(clinic.ctx.clinic.id, daysAgo(85), "done");
    await note(clinic.ctx.clinic.id, daysAgo(10), "open");
    await note(other.ctx.clinic.id, daysAgo(30), "open");

    const result = await openCallbacksNearingDeletion(db, now);
    expect(result).toEqual([{ clinicId: clinic.ctx.clinic.id, open: 2 }]);
  });
});
