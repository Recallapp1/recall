import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import { bookAppointment, cancelAppointment, rescheduleAppointment } from "./appointments";
import { DomainError } from "./errors";
import {
  addExampleRules,
  applyPlanAction,
  archiveRule,
  autoLinkAppointment,
  getPlanDetail,
  listPlans,
  recomputeStalePlans,
  saveRule,
  startPlan,
  type FollowUpScope,
} from "./follow-ups";
import { changeAppointmentStatus, scopeFor } from "./panel";
import { localToUtc } from "./time";

let db: Database;
let close: () => Promise<void>;

// Sunday 4 October 2026, 12:00 Istanbul.
const NOW = new Date("2026-10-04T09:00:00Z");
const TZ = "Europe/Istanbul";
let phoneSeq = 0;
const nextPhone = () => `+9053211${String((phoneSeq += 1)).padStart(5, "0")}`;

const scope = (clinic: TestClinic): FollowUpScope => ({
  clinicId: clinic.ctx.clinic.id,
  timeZone: TZ,
});

async function rule(clinic: TestClinic, overrides: Partial<Parameters<typeof saveRule>[3]> = {}) {
  return saveRule(db, clinic.ctx.clinic.id, null, {
    name: "Kontrol takibi",
    triggerServiceId: clinic.serviceId,
    visitServiceId: clinic.serviceId,
    intervalValue: 6,
    intervalUnit: "month",
    totalVisits: null,
    smsReminders: false,
    isActive: true,
    ...overrides,
  });
}

function book(clinic: TestClinic, phone: string, date: string, time: string) {
  return bookAppointment(db, clinic.ctx, {
    serviceId: clinic.serviceId,
    practitionerId: clinic.practitionerId,
    date,
    time,
    patientName: "Ayşe Yılmaz",
    patientPhone: phone,
    source: "panel",
    now: NOW,
  });
}

async function patientIdOf(clinic: TestClinic, phone: string) {
  const [row] = await db
    .select({ id: schema.patients.id })
    .from(schema.patients)
    .where(
      and(eq(schema.patients.clinicId, clinic.ctx.clinic.id), eq(schema.patients.phone, phone)),
    );
  return row!.id;
}

/** A past appointment straight into the table (booking refuses the past). */
async function pastAppointment(clinic: TestClinic, patientId: string, date: string) {
  const startsAt = localToUtc(date, 10 * 60, TZ);
  const [row] = await db
    .insert(schema.appointments)
    .values({
      clinicId: clinic.ctx.clinic.id,
      patientId,
      practitionerId: clinic.practitionerId,
      serviceId: clinic.serviceId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60_000),
      source: "panel",
    })
    .returning();
  return row!;
}

async function planRow(planId: string) {
  const [row] = await db
    .select()
    .from(schema.followUpPlans)
    .where(eq(schema.followUpPlans.id, planId));
  return row!;
}

async function visitsOf(planId: string) {
  return db.select().from(schema.followUpVisits).where(eq(schema.followUpVisits.planId, planId));
}

async function expectDomainError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(DomainError);
  await expect(promise).rejects.toMatchObject({ code });
}

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

describe("rules", () => {
  it("adds sector examples once: inactive, without an interval", async () => {
    const clinic = await createTestClinic(db);
    expect(await addExampleRules(db, clinic.ctx.clinic.id, "genel")).toBe(1);
    expect(await addExampleRules(db, clinic.ctx.clinic.id, "genel")).toBe(0);
    const [example] = await db
      .select()
      .from(schema.followUpRules)
      .where(eq(schema.followUpRules.clinicId, clinic.ctx.clinic.id));
    expect(example).toMatchObject({
      isActive: false,
      intervalValue: null,
      templateKey: "genel.kontrol",
    });
  });

  it("refuses to activate a rule without an interval (database check)", async () => {
    const clinic = await createTestClinic(db);
    await expect(rule(clinic, { intervalValue: null, intervalUnit: null })).rejects.toThrow();
  });

  it("refuses another clinic's service", async () => {
    const a = await createTestClinic(db);
    const b = await createTestClinic(db);
    await expectDomainError(rule(a, { visitServiceId: b.serviceId }), "INVALID_SERVICE");
  });

  it("archived rules keep their plans but start no new ones", async () => {
    const clinic = await createTestClinic(db);
    const ruleId = await rule(clinic);
    const phone = nextPhone();
    await book(clinic, phone, "2026-10-05", "10:00");
    const patientId = await patientIdOf(clinic, phone);
    const planId = await startPlan(
      db,
      scope(clinic),
      null,
      { ruleId, patientId, appointmentId: null, startedOn: "2026-10-01", smsConsent: false },
      NOW,
    );
    await archiveRule(db, clinic.ctx.clinic.id, ruleId, NOW);
    expect((await planRow(planId)).state).toBe("active");
    const other = nextPhone();
    await book(clinic, other, "2026-10-05", "11:00");
    await expectDomainError(
      startPlan(
        db,
        scope(clinic),
        null,
        {
          ruleId,
          patientId: await patientIdOf(clinic, other),
          appointmentId: null,
          startedOn: null,
          smsConsent: false,
        },
        NOW,
      ),
      "NOT_FOUND",
    );
  });
});

describe("starting and linking", () => {
  it("starts from an appointment, which becomes the first visit", async () => {
    const clinic = await createTestClinic(db);
    const ruleId = await rule(clinic);
    const phone = nextPhone();
    const { appointment } = await book(clinic, phone, "2026-10-05", "10:00");
    const patientId = await patientIdOf(clinic, phone);
    const planId = await startPlan(
      db,
      scope(clinic),
      null,
      { ruleId, patientId, appointmentId: appointment.id, startedOn: null, smsConsent: true },
      NOW,
    );

    const plan = await planRow(planId);
    expect(plan).toMatchObject({ startedOn: "2026-10-05", state: "active", visitsDone: 0 });
    expect(plan.smsConsentAt).not.toBeNull();
    expect(await visitsOf(planId)).toEqual([
      expect.objectContaining({ source: "start", appointmentId: appointment.id }),
    ]);
    // One open plan per patient and rule.
    await expectDomainError(
      startPlan(
        db,
        scope(clinic),
        null,
        { ruleId, patientId, appointmentId: null, startedOn: null, smsConsent: false },
        NOW,
      ),
      "FOLLOW_UP_EXISTS",
    );
  });

  it("auto-links a new booking when exactly one plan fits, flags ambiguity otherwise", async () => {
    const clinic = await createTestClinic(db);
    const first = await rule(clinic, { name: "A" });
    const second = await rule(clinic, { name: "B" });
    const phone = nextPhone();
    await book(clinic, phone, "2026-10-05", "09:00");
    const patientId = await patientIdOf(clinic, phone);
    const planA = await startPlan(
      db,
      scope(clinic),
      null,
      { ruleId: first, patientId, appointmentId: null, startedOn: "2026-04-01", smsConsent: false },
      NOW,
    );

    // The 09:00 booking predates the plan; a new one links automatically.
    const { appointment } = await book(clinic, phone, "2026-10-06", "09:00");
    expect(await visitsOf(planA)).toEqual([
      expect.objectContaining({ source: "auto_link", appointmentId: appointment.id }),
    ]);

    // A second plan on the same service: the next booking is ambiguous.
    const planB = await startPlan(
      db,
      scope(clinic),
      null,
      {
        ruleId: second,
        patientId,
        appointmentId: null,
        startedOn: "2026-04-01",
        smsConsent: false,
      },
      NOW,
    );
    await applyPlanAction(
      db,
      scope(clinic),
      null,
      { type: "unlink", planId: planA, appointmentId: appointment.id },
      NOW,
    );
    const result = await autoLinkAppointment(
      db,
      scope(clinic),
      { id: appointment.id, patientId, serviceId: clinic.serviceId },
      NOW,
    );
    expect(result).toEqual({ linkedPlanId: null, ambiguous: true });
    expect((await planRow(planA)).needsReview).toBe(true);
    expect((await planRow(planB)).needsReview).toBe(true);

    // Staff resolve it by linking.
    await applyPlanAction(
      db,
      scope(clinic),
      null,
      { type: "link", planId: planB, appointmentId: appointment.id },
      NOW,
    );
    expect((await planRow(planA)).needsReview).toBe(false);
    expect(await visitsOf(planB)).toEqual([expect.objectContaining({ source: "staff_link" })]);
  });

  it("moves the link when the appointment is rescheduled, and drops it on cancel", async () => {
    const clinic = await createTestClinic(db);
    const ruleId = await rule(clinic);
    const phone = nextPhone();
    await book(clinic, phone, "2026-10-05", "10:00");
    const patientId = await patientIdOf(clinic, phone);
    const planId = await startPlan(
      db,
      scope(clinic),
      null,
      { ruleId, patientId, appointmentId: null, startedOn: "2026-04-01", smsConsent: false },
      NOW,
    );
    const { appointment } = await book(clinic, phone, "2026-10-07", "10:00");
    expect((await visitsOf(planId))[0]!.appointmentId).toBe(appointment.id);

    const moved = await rescheduleAppointment(db, clinic.ctx, {
      appointmentId: appointment.id,
      phone,
      date: "2026-10-08",
      time: "11:00",
      now: NOW,
    });
    expect((await visitsOf(planId))[0]!.appointmentId).toBe(moved.appointment.id);
    let [row] = (await listPlans(db, scope(clinic), NOW, 14)).filter((r) => r.id === planId);
    expect(row!.view).toBe("booked");

    await cancelAppointment(db, clinic.ctx, {
      appointmentId: moved.appointment.id,
      phone,
      now: NOW,
    });
    [row] = (await listPlans(db, scope(clinic), NOW, 14)).filter((r) => r.id === planId);
    // Due 1 October (6 months after 1 April): no longer booked, overdue.
    expect(row!.view).toBe("overdue");
  });
});

describe("counting visits", () => {
  it("counts a passed, unmarked appointment automatically and a no-show not at all", async () => {
    const clinic = await createTestClinic(db);
    const ruleId = await rule(clinic, { intervalValue: 30, intervalUnit: "day", totalVisits: 3 });
    const phone = nextPhone();
    await book(clinic, phone, "2026-10-05", "10:00");
    const patientId = await patientIdOf(clinic, phone);
    const planId = await startPlan(
      db,
      scope(clinic),
      null,
      { ruleId, patientId, appointmentId: null, startedOn: "2026-08-01", smsConsent: false },
      NOW,
    );
    const past = await pastAppointment(clinic, patientId, "2026-09-01");
    await applyPlanAction(
      db,
      scope(clinic),
      null,
      { type: "link", planId, appointmentId: past.id },
      NOW,
    );

    expect(await planRow(planId)).toMatchObject({ visitsDone: 1, nextDueOn: "2026-10-01" });
    const detail = await getPlanDetail(db, scope(clinic), planId, NOW);
    expect(detail.visits[0]!.status).toEqual({ kind: "counted", date: "2026-09-01", auto: true });

    await changeAppointmentStatus(db, scopeFor(clinic.ctx), {
      appointmentId: past.id,
      status: "no_show",
      now: NOW,
    });
    expect(await planRow(planId)).toMatchObject({ visitsDone: 0, nextDueOn: "2026-08-31" });
  });

  it("recomputes plans whose appointment passed since their last calculation", async () => {
    const clinic = await createTestClinic(db);
    const ruleId = await rule(clinic, { intervalValue: 2, intervalUnit: "week" });
    const phone = nextPhone();
    const { appointment } = await book(clinic, phone, "2026-10-05", "10:00");
    const patientId = await patientIdOf(clinic, phone);
    const planId = await startPlan(
      db,
      scope(clinic),
      null,
      { ruleId, patientId, appointmentId: appointment.id, startedOn: null, smsConsent: false },
      NOW,
    );
    expect((await planRow(planId)).visitsDone).toBe(0);

    const later = new Date("2026-10-06T09:00:00Z");
    expect(await recomputeStalePlans(db, scope(clinic), later)).toBe(1);
    expect(await planRow(planId)).toMatchObject({ visitsDone: 1, nextDueOn: "2026-10-19" });
    // Nothing left to do on the next run.
    expect(await recomputeStalePlans(db, scope(clinic), later)).toBe(0);
  });

  it("records visits without an appointment and completes a fixed course", async () => {
    const clinic = await createTestClinic(db);
    const ruleId = await rule(clinic, { intervalValue: 1, intervalUnit: "month", totalVisits: 2 });
    const phone = nextPhone();
    await book(clinic, phone, "2026-10-05", "10:00");
    const patientId = await patientIdOf(clinic, phone);
    const planId = await startPlan(
      db,
      scope(clinic),
      null,
      { ruleId, patientId, appointmentId: null, startedOn: "2026-08-01", smsConsent: false },
      NOW,
    );
    await applyPlanAction(
      db,
      scope(clinic),
      null,
      { type: "record_visit", planId, visitedOn: "2026-08-01" },
      NOW,
    );
    await applyPlanAction(
      db,
      scope(clinic),
      null,
      { type: "record_visit", planId, visitedOn: "2026-09-02" },
      NOW,
    );
    expect(await planRow(planId)).toMatchObject({
      state: "completed",
      visitsDone: 2,
      nextDueOn: null,
    });
  });
});

describe("staff actions", () => {
  it("pauses, resumes, sets a date and stops with a reason", async () => {
    const clinic = await createTestClinic(db);
    const ruleId = await rule(clinic);
    const phone = nextPhone();
    await book(clinic, phone, "2026-10-05", "10:00");
    const patientId = await patientIdOf(clinic, phone);
    const planId = await startPlan(
      db,
      scope(clinic),
      null,
      { ruleId, patientId, appointmentId: null, startedOn: "2026-04-01", smsConsent: false },
      NOW,
    );
    const s = scope(clinic);

    await applyPlanAction(db, s, null, { type: "pause", planId }, NOW);
    expect((await planRow(planId)).state).toBe("paused");
    await expectDomainError(
      applyPlanAction(db, s, null, { type: "pause", planId }, NOW),
      "INVALID_TRANSITION",
    );
    await applyPlanAction(db, s, null, { type: "resume", planId }, NOW);
    await applyPlanAction(db, s, null, { type: "set_due", planId, dueOn: "2026-12-01" }, NOW);
    expect((await planRow(planId)).nextDueOn).toBe("2026-12-01");
    await applyPlanAction(db, s, null, { type: "stop", planId, reason: "patient_request" }, NOW);
    expect(await planRow(planId)).toMatchObject({
      state: "stopped",
      stoppedReason: "patient_request",
      nextDueOn: null,
    });
    // A stopped plan frees the rule for a new start.
    await startPlan(
      db,
      s,
      null,
      { ruleId, patientId, appointmentId: null, startedOn: null, smsConsent: false },
      NOW,
    );
  });
});

describe("tenant isolation", () => {
  it("no write path crosses clinics", async () => {
    const a = await createTestClinic(db);
    const b = await createTestClinic(db);
    const ruleA = await rule(a);
    const ruleB = await rule(b);
    const phone = nextPhone();
    await book(a, phone, "2026-10-05", "10:00");
    const { appointment: bAppointment } = await book(b, phone, "2026-10-05", "10:00");
    const patientA = await patientIdOf(a, phone);
    const patientB = await patientIdOf(b, phone);
    const planA = await startPlan(
      db,
      scope(a),
      null,
      {
        ruleId: ruleA,
        patientId: patientA,
        appointmentId: null,
        startedOn: "2026-04-01",
        smsConsent: false,
      },
      NOW,
    );

    // B cannot act on A's plan, start from A's rule or patient, or link its appointment into A.
    await expectDomainError(
      applyPlanAction(db, scope(b), null, { type: "pause", planId: planA }, NOW),
      "NOT_FOUND",
    );
    await expectDomainError(
      startPlan(
        db,
        scope(b),
        null,
        {
          ruleId: ruleA,
          patientId: patientB,
          appointmentId: null,
          startedOn: null,
          smsConsent: false,
        },
        NOW,
      ),
      "NOT_FOUND",
    );
    await expectDomainError(
      startPlan(
        db,
        scope(b),
        null,
        {
          ruleId: ruleB,
          patientId: patientA,
          appointmentId: null,
          startedOn: null,
          smsConsent: false,
        },
        NOW,
      ),
      "NOT_FOUND",
    );
    await expectDomainError(
      applyPlanAction(
        db,
        scope(a),
        null,
        { type: "link", planId: planA, appointmentId: bAppointment.id },
        NOW,
      ),
      "NOT_FOUND",
    );
    // The database refuses it even if a code path forgot to check.
    await expect(
      db.insert(schema.followUpVisits).values({
        clinicId: a.ctx.clinic.id,
        planId: planA,
        appointmentId: bAppointment.id,
        source: "staff_link",
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(schema.followUpPlans).values({
        clinicId: a.ctx.clinic.id,
        patientId: patientB,
        ruleId: ruleA,
        name: "x",
        visitServiceId: a.serviceId,
        intervalValue: 1,
        intervalUnit: "month",
        startedOn: "2026-10-01",
      }),
    ).rejects.toThrow();
    // Lists stay within the clinic.
    expect((await listPlans(db, scope(b), NOW, 14)).map((r) => r.id)).not.toContain(planA);
    // Auto-linking B's booking never touches A's plan.
    expect(await visitsOf(planA)).toEqual([]);
  });
});
