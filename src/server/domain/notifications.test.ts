import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import { parseClinicSettings, type ClinicSettingsInput } from "./clinic-settings";
import {
  appointmentReminderKey,
  dispatchNotifications,
  MAX_ATTEMPTS,
  planAppointmentReminders,
  runNotificationJob,
  STALE_SENDING_MS,
  type DispatchDeps,
} from "./notifications";
import { anonymizePatient } from "./panel";
import { localToUtc } from "./time";

let db: Database;
let close: () => Promise<void>;

// Monday 5 October 2026, 10:00 Istanbul (07:00 UTC): inside the 09–20 window.
const NOW = new Date("2026-10-05T07:00:00Z");
const TODAY = "2026-10-05";
const TOMORROW = "2026-10-06";
const TZ = "Europe/Istanbul";

function clinicRow(clinic: TestClinic, settings?: ClinicSettingsInput) {
  return {
    id: clinic.ctx.clinic.id,
    name: clinic.ctx.clinic.name,
    timezone: TZ,
    settings: parseClinicSettings(settings ?? clinic.ctx.clinic.settings),
  };
}

let phoneCounter = 0;
async function patient(clinic: TestClinic, overrides: Partial<schema.Patient> = {}) {
  phoneCounter += 1;
  const [row] = await db
    .insert(schema.patients)
    .values({
      clinicId: clinic.ctx.clinic.id,
      fullName: "Ayşe Yılmaz",
      phone: `+9053200${String(phoneCounter).padStart(5, "0")}`,
      ...overrides,
    })
    .returning();
  return row;
}

async function appointment(
  clinic: TestClinic,
  patientId: string,
  date: string,
  minute: number,
  status: schema.Appointment["status"] = "scheduled",
) {
  const startsAt = localToUtc(date, minute, TZ);
  const [row] = await db
    .insert(schema.appointments)
    .values({
      clinicId: clinic.ctx.clinic.id,
      patientId,
      practitionerId: clinic.practitionerId,
      serviceId: clinic.serviceId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60_000),
      status,
      source: "panel",
    })
    .returning();
  return row;
}

async function rowsFor(clinic: TestClinic) {
  return db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.clinicId, clinic.ctx.clinic.id));
}

function fakeProvider(delivers = true) {
  const sent: { to: string; body: string }[] = [];
  return {
    sent,
    provider: {
      delivers,
      send: vi.fn(async (to: string, body: string) => {
        sent.push({ to, body });
      }),
    },
  };
}

function deps(overrides: Partial<DispatchDeps> = {}): DispatchDeps {
  return {
    now: NOW,
    sendingEnabled: true,
    provider: fakeProvider().provider,
    providerName: "test",
    ...overrides,
  };
}

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

describe("planAppointmentReminders", () => {
  let clinic: TestClinic;
  beforeEach(async () => {
    clinic = await createTestClinic(db);
  });

  it("plans tomorrow's active appointments once, and skips cancelled ones", async () => {
    const p = await patient(clinic);
    const kept = await appointment(clinic, p.id, TOMORROW, 10 * 60);
    await appointment(clinic, p.id, TOMORROW, 11 * 60, "cancelled");

    expect(await planAppointmentReminders(db, clinicRow(clinic), NOW)).toEqual({
      planned: 1,
      tooLate: 0,
    });
    // A second run (retry, overlapping cron) adds nothing.
    expect(await planAppointmentReminders(db, clinicRow(clinic), NOW)).toEqual({
      planned: 0,
      tooLate: 0,
    });
    const rows = await rowsFor(clinic);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: "pending",
      kind: "appointment_reminder",
      subjectId: kept.id,
      patientId: p.id,
      templateKey: "appointment_reminder.v1",
      dedupeKey: appointmentReminderKey(kept.id, kept.startsAt),
    });
  });

  it("records an appointment booked after the daily run as skipped too_late", async () => {
    const p = await patient(clinic);
    // Booked yesterday afternoon for this morning: yesterday's run never saw it.
    await appointment(clinic, p.id, TODAY, 16 * 60);
    expect(await planAppointmentReminders(db, clinicRow(clinic), NOW)).toEqual({
      planned: 0,
      tooLate: 1,
    });
    const [row] = await rowsFor(clinic);
    expect(row).toMatchObject({ status: "skipped", skipReason: "too_late" });
  });

  it("does not mark an appointment too_late when yesterday's run planned it", async () => {
    const p = await patient(clinic);
    await appointment(clinic, p.id, TODAY, 16 * 60);
    const yesterday = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
    await planAppointmentReminders(db, clinicRow(clinic), yesterday);
    expect(await planAppointmentReminders(db, clinicRow(clinic), NOW)).toEqual({
      planned: 0,
      tooLate: 0,
    });
    expect((await rowsFor(clinic)).map((r) => r.status)).toEqual(["pending"]);
  });

  it("plans nothing when the clinic has reminders turned off", async () => {
    const p = await patient(clinic);
    await appointment(clinic, p.id, TOMORROW, 10 * 60);
    const off = clinicRow(clinic, { notifications: { smsReminderHoursBefore: null } });
    expect(await planAppointmentReminders(db, off, NOW)).toEqual({ planned: 0, tooLate: 0 });
    expect(await rowsFor(clinic)).toEqual([]);
  });
});

describe("dispatchNotifications: SMS locks", () => {
  it("never calls the provider while SMS_SENDING_ENABLED is off", async () => {
    const clinic = await createTestClinic(db);
    const p = await patient(clinic);
    await appointment(clinic, p.id, TOMORROW, 10 * 60);
    await planAppointmentReminders(db, clinicRow(clinic), NOW);

    const { provider } = fakeProvider(true);
    const result = await dispatchNotifications(
      db,
      clinicRow(clinic),
      deps({ sendingEnabled: false, provider }),
    );
    expect(result.skipped).toBe(1);
    expect(provider.send).not.toHaveBeenCalled();
    expect((await rowsFor(clinic))[0]).toMatchObject({
      status: "skipped",
      skipReason: "sending_disabled",
    });
  });

  it("never calls a non-delivering provider (console stub)", async () => {
    const clinic = await createTestClinic(db);
    const p = await patient(clinic);
    await appointment(clinic, p.id, TOMORROW, 10 * 60);
    await planAppointmentReminders(db, clinicRow(clinic), NOW);

    const { provider } = fakeProvider(false);
    await dispatchNotifications(db, clinicRow(clinic), deps({ provider }));
    expect(provider.send).not.toHaveBeenCalled();
    expect((await rowsFor(clinic))[0]).toMatchObject({ skipReason: "provider_disabled" });
  });

  it("skips when the clinic turned reminders off after planning", async () => {
    const clinic = await createTestClinic(db);
    const p = await patient(clinic);
    await appointment(clinic, p.id, TOMORROW, 10 * 60);
    await planAppointmentReminders(db, clinicRow(clinic), NOW);
    const { provider } = fakeProvider();
    const off = clinicRow(clinic, { notifications: { smsReminderHoursBefore: null } });
    await dispatchNotifications(db, off, deps({ provider }));
    expect(provider.send).not.toHaveBeenCalled();
    expect((await rowsFor(clinic))[0]).toMatchObject({ skipReason: "feature_off" });
  });
});

describe("dispatchNotifications: sending", () => {
  it("sends once, with a generic text, to the patient's number", async () => {
    const clinic = await createTestClinic(db);
    const p = await patient(clinic, { fullName: "Gizli İsim" });
    await appointment(clinic, p.id, TOMORROW, 14 * 60 + 30);
    await planAppointmentReminders(db, clinicRow(clinic), NOW);

    const fake = fakeProvider();
    const first = await dispatchNotifications(
      db,
      clinicRow(clinic),
      deps({ provider: fake.provider }),
    );
    const second = await dispatchNotifications(
      db,
      clinicRow(clinic),
      deps({ provider: fake.provider }),
    );
    expect(first.sent).toBe(1);
    expect(second.sent).toBe(0);
    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0]!.to).toBe(p.phone);
    expect(fake.sent[0]!.body).toContain("14:30");
    // KVKK: no patient name, no service in the text.
    expect(fake.sent[0]!.body).not.toContain("Gizli");
    expect(fake.sent[0]!.body).not.toContain("Muayene");
    expect((await rowsFor(clinic))[0]).toMatchObject({ status: "sent", provider: "test" });
  });

  it("skips opted-out patients and appointments that changed or ended", async () => {
    const clinic = await createTestClinic(db);
    const optedOut = await patient(clinic, { smsOptOutAt: NOW });
    await appointment(clinic, optedOut.id, TOMORROW, 9 * 60);
    const other = await patient(clinic);
    const cancelled = await appointment(clinic, other.id, TOMORROW, 10 * 60);
    const third = await patient(clinic);
    const moved = await appointment(clinic, third.id, TOMORROW, 11 * 60);
    await planAppointmentReminders(db, clinicRow(clinic), NOW);

    await db
      .update(schema.appointments)
      .set({ status: "cancelled" })
      .where(eq(schema.appointments.id, cancelled.id));
    await db
      .update(schema.appointments)
      .set({
        startsAt: localToUtc(TOMORROW, 15 * 60, TZ),
        endsAt: localToUtc(TOMORROW, 15 * 60 + 30, TZ),
      })
      .where(eq(schema.appointments.id, moved.id));

    const fake = fakeProvider();
    await dispatchNotifications(db, clinicRow(clinic), deps({ provider: fake.provider }));
    expect(fake.provider.send).not.toHaveBeenCalled();
    const reasons = (await rowsFor(clinic)).map((r) => r.skipReason).sort();
    expect(reasons).toEqual(["opted_out", "subject_changed", "subject_changed"]);
  });

  it("sends at most one message per patient per day", async () => {
    const clinic = await createTestClinic(db);
    const p = await patient(clinic);
    await appointment(clinic, p.id, TOMORROW, 9 * 60);
    await appointment(clinic, p.id, TOMORROW, 15 * 60);
    await planAppointmentReminders(db, clinicRow(clinic), NOW);
    const fake = fakeProvider();
    await dispatchNotifications(db, clinicRow(clinic), deps({ provider: fake.provider }));
    expect(fake.sent).toHaveLength(1);
    expect((await rowsFor(clinic)).map((r) => r.skipReason ?? r.status).sort()).toEqual([
      "cap_reached",
      "sent",
    ]);
  });

  it("retries a failed send later and gives up after the last attempt", async () => {
    const clinic = await createTestClinic(db);
    const p = await patient(clinic);
    await appointment(clinic, p.id, TOMORROW, 10 * 60);
    await planAppointmentReminders(db, clinicRow(clinic), NOW);
    const failing = {
      delivers: true,
      send: vi.fn(async () => Promise.reject(new Error("http_500"))),
    };

    let now = NOW;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      await dispatchNotifications(db, clinicRow(clinic), deps({ provider: failing, now }));
      now = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    }
    expect(failing.send).toHaveBeenCalledTimes(MAX_ATTEMPTS);
    expect((await rowsFor(clinic))[0]).toMatchObject({
      status: "failed",
      attempts: MAX_ATTEMPTS,
      errorCode: "http_500",
    });
    // Nothing left to send.
    await dispatchNotifications(db, clinicRow(clinic), deps({ provider: failing, now }));
    expect(failing.send).toHaveBeenCalledTimes(MAX_ATTEMPTS);
  });

  it("marks a send stuck in progress as unknown and never resends it", async () => {
    const clinic = await createTestClinic(db);
    const p = await patient(clinic);
    await appointment(clinic, p.id, TOMORROW, 10 * 60);
    await planAppointmentReminders(db, clinicRow(clinic), NOW);
    await db
      .update(schema.notifications)
      .set({ status: "sending", lockedAt: new Date(NOW.getTime() - STALE_SENDING_MS - 1000) })
      .where(eq(schema.notifications.clinicId, clinic.ctx.clinic.id));

    const fake = fakeProvider();
    const result = await dispatchNotifications(
      db,
      clinicRow(clinic),
      deps({ provider: fake.provider }),
    );
    expect(result.unknown).toBe(1);
    expect(fake.provider.send).not.toHaveBeenCalled();
    expect((await rowsFor(clinic))[0]).toMatchObject({ status: "unknown" });
  });

  it("leaves messages pending outside 09:00–20:00 clinic time", async () => {
    const clinic = await createTestClinic(db);
    const p = await patient(clinic);
    await appointment(clinic, p.id, TOMORROW, 10 * 60);
    await planAppointmentReminders(db, clinicRow(clinic), NOW);
    const night = new Date("2026-10-05T19:30:00Z"); // 22:30 Istanbul
    const fake = fakeProvider();
    await dispatchNotifications(
      db,
      clinicRow(clinic),
      deps({ provider: fake.provider, now: night }),
    );
    expect(fake.provider.send).not.toHaveBeenCalled();
    expect((await rowsFor(clinic))[0]).toMatchObject({ status: "pending" });
  });
});

describe("tenant isolation", () => {
  it("rejects a notification pointing at another clinic's patient (composite FK)", async () => {
    const a = await createTestClinic(db);
    const b = await createTestClinic(db);
    const bPatient = await patient(b);
    await expect(
      db.insert(schema.notifications).values({
        clinicId: a.ctx.clinic.id,
        patientId: bPatient.id,
        kind: "appointment_reminder",
        subjectId: bPatient.id,
        dedupeKey: "cross-tenant",
        templateKey: "appointment_reminder.v1",
        scheduledFor: NOW,
      }),
    ).rejects.toThrow();
  });

  it("plans and sends for one clinic without touching another's rows", async () => {
    const a = await createTestClinic(db);
    const b = await createTestClinic(db);
    await appointment(a, (await patient(a)).id, TOMORROW, 10 * 60);
    await appointment(b, (await patient(b)).id, TOMORROW, 10 * 60);

    await planAppointmentReminders(db, clinicRow(a), NOW);
    expect(await rowsFor(a)).toHaveLength(1);
    expect(await rowsFor(b)).toEqual([]);

    await planAppointmentReminders(db, clinicRow(b), NOW);
    const fake = fakeProvider();
    await dispatchNotifications(db, clinicRow(a), deps({ provider: fake.provider }));
    expect(fake.sent).toHaveLength(1);
    expect((await rowsFor(b))[0]).toMatchObject({ status: "pending" });
  });

  it("the daily job isolates a failing clinic from the others", async () => {
    const broken = await createTestClinic(db);
    await db
      .update(schema.clinics)
      .set({ timezone: "Invalid/Zone" })
      .where(eq(schema.clinics.id, broken.ctx.clinic.id));
    const healthy = await createTestClinic(db);
    await appointment(healthy, (await patient(healthy)).id, TOMORROW, 10 * 60);

    const failures: string[] = [];
    const result = await runNotificationJob(db, deps({ sendingEnabled: false }), ({ clinicId }) =>
      failures.push(clinicId),
    );
    expect(failures).toEqual([broken.ctx.clinic.id]);
    expect(result.failedClinics).toBe(1);
    expect(await rowsFor(healthy)).toHaveLength(1);
  });
});

describe("KVKK", () => {
  it("anonymizing a patient detaches the log and drops pending messages", async () => {
    const clinic = await createTestClinic(db);
    const p = await patient(clinic);
    await appointment(clinic, p.id, TOMORROW, 10 * 60);
    await planAppointmentReminders(db, clinicRow(clinic), NOW);

    await anonymizePatient(db, clinic.ctx.clinic.id, p.id);
    const rows = await db
      .select()
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.clinicId, clinic.ctx.clinic.id),
          eq(schema.notifications.kind, "appointment_reminder"),
        ),
      );
    expect(rows).toEqual([
      expect.objectContaining({
        patientId: null,
        status: "skipped",
        skipReason: "patient_removed",
      }),
    ]);
  });

  it("deleting a patient keeps the log row without the person", async () => {
    const clinic = await createTestClinic(db);
    const p = await patient(clinic);
    await appointment(clinic, p.id, TOMORROW, 10 * 60);
    await planAppointmentReminders(db, clinicRow(clinic), NOW);
    await db.delete(schema.patients).where(eq(schema.patients.id, p.id));
    const rows = await rowsFor(clinic);
    // Appointments cascade with the patient; the log row stays, unlinked.
    expect(rows).toEqual([expect.objectContaining({ patientId: null })]);
  });
});
