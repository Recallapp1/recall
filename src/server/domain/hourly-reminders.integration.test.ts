import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import type { Database } from "../db";
import { notifications } from "../db/schema";
import { bookAppointment } from "./appointments";
import { parseClinicSettings } from "./clinic-settings";
import { planAppointmentReminders, planDueReminders, runNotificationJob } from "./notifications";

/*
 * R2 5b: hourly reminders honour smsReminderHoursBefore, catch bookings made
 * inside the window, and never duplicate the daily planner's reminders.
 */

// Monday 2026-10-05 08:40 Istanbul.
const NOW = new Date("2026-10-05T05:40:00Z");

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

async function clinicWithBookings() {
  const clinic = await createTestClinic(db);
  const book = (date: string, time: string, n: number) =>
    bookAppointment(db, clinic.ctx, {
      serviceId: clinic.serviceId,
      practitionerId: clinic.practitionerId,
      date,
      time,
      patientName: `Hatırlatma Hasta ${n}`,
      patientPhone: `+9053200004${String(n).padStart(2, "0")}`,
      source: "panel",
      now: new Date("2026-10-01T09:00:00Z"),
    });
  const ids = {
    in20min: (await book("2026-10-05", "09:00", 1)).appointment.id,
    in3h: (await book("2026-10-05", "12:00", 2)).appointment.id,
    in8h: (await book("2026-10-05", "16:30", 3)).appointment.id,
    in25h: (await book("2026-10-06", "10:00", 4)).appointment.id,
  };
  return { clinic, ids };
}

function row(clinic: TestClinic) {
  return {
    id: clinic.ctx.clinic.id,
    name: clinic.ctx.clinic.name,
    timezone: clinic.ctx.clinic.timezone,
    settings: parseClinicSettings(clinic.ctx.clinic.settings),
  };
}

async function remindersOf(clinic: TestClinic) {
  return db
    .select({
      subjectId: notifications.subjectId,
      status: notifications.status,
      skip: notifications.skipReason,
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.clinicId, clinic.ctx.clinic.id),
        eq(notifications.kind, "appointment_reminder"),
      ),
    );
}

describe("planDueReminders (R2 5b)", () => {
  it("plans what is inside the 24-hour window, marks under an hour as too late, leaves the rest", async () => {
    const { clinic, ids } = await clinicWithBookings();
    expect(await planDueReminders(db, row(clinic), NOW)).toEqual({ planned: 2, tooLate: 1 });
    const byId = new Map((await remindersOf(clinic)).map((r) => [r.subjectId, r]));
    expect(byId.get(ids.in3h)?.status).toBe("pending");
    expect(byId.get(ids.in8h)?.status).toBe("pending");
    expect(byId.get(ids.in20min)).toMatchObject({ status: "skipped", skip: "too_late" });
    expect(byId.has(ids.in25h)).toBe(false);

    // The next hour adds nothing twice.
    expect(
      await planDueReminders(db, row(clinic), new Date(NOW.getTime() + 60 * 60 * 1000)),
    ).toEqual({ planned: 0, tooLate: 0 });
  });

  it("never duplicates a reminder the daily planner already made", async () => {
    const { clinic } = await clinicWithBookings();
    // Sunday's daily run planned Monday's reminders.
    await planAppointmentReminders(db, row(clinic), new Date("2026-10-04T07:00:00Z"));
    const before = (await remindersOf(clinic)).length;
    await planDueReminders(db, row(clinic), NOW);
    const after = await remindersOf(clinic);
    expect(new Set(after.map((r) => r.subjectId)).size).toBe(after.length);
    expect(after.length).toBeGreaterThanOrEqual(before);
  });

  it("follows the clinic's hours setting and stays off when reminders are off", async () => {
    const short = await createTestClinic(db, {
      settings: {
        booking: { minNoticeMinutes: 0, slotIntervalMinutes: 30 },
        notifications: { smsReminderHoursBefore: 2 },
      },
    });
    await bookAppointment(db, short.ctx, {
      serviceId: short.serviceId,
      practitionerId: short.practitionerId,
      date: "2026-10-05",
      time: "12:00",
      patientName: "Kısa Pencere",
      patientPhone: "+905320000499",
      source: "panel",
      now: new Date("2026-10-01T09:00:00Z"),
    });
    expect(await planDueReminders(db, row(short), NOW)).toEqual({ planned: 0, tooLate: 0 });
    const off = await createTestClinic(db, {
      settings: { notifications: { smsReminderHoursBefore: null } },
    });
    expect(await planDueReminders(db, row(off), NOW)).toEqual({ planned: 0, tooLate: 0 });
  });
});

describe("daily job hand-over", () => {
  it("with hourlyReminders the daily job plans no appointment reminders; unset it does, as before", async () => {
    const { clinic } = await clinicWithBookings();
    const deps = {
      now: new Date("2026-10-04T07:00:00Z"),
      sendingEnabled: false,
      provider: { delivers: false, send: async () => {} },
      providerName: "console",
    };
    await runNotificationJob(db, deps, () => {}, { hourlyReminders: true });
    expect(await remindersOf(clinic)).toHaveLength(0);
    // A second run on the same day is skipped by the run record; use the next day.
    await runNotificationJob(db, { ...deps, now: new Date("2026-10-05T07:00:00Z") });
    expect((await remindersOf(clinic)).length).toBeGreaterThan(0);
  });
});
