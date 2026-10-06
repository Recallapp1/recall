import "server-only";

import { and, asc, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";

import { ACTIVE_APPOINTMENT_STATUSES } from "@/lib/contracts/appointment";
import type {
  FollowUpRuleInput,
  FollowUpView,
  PlanAction,
  StartPlanInput,
} from "@/lib/contracts/follow-up";
import { FOLLOW_UP_EXAMPLES, type ClinicTemplate } from "@/lib/clinic-templates";

import type { Executor } from "../db";
import {
  appointments,
  followUpPlans,
  followUpRules,
  followUpVisits,
  notifications,
  patients,
  services,
  type FollowUpPlan,
} from "../db/schema";
import { DomainError } from "./errors";
import {
  classifyVisit,
  computeFollowUp,
  followUpView,
  type PlanOutcome,
  type VisitStatus,
} from "./follow-up-logic";
import { localToday, utcToLocal, type LocalDate } from "./time";

/** Follow-up ("Takip") persistence. Every query is scoped by clinic_id. */
export interface FollowUpScope {
  clinicId: string;
  timeZone: string;
}

const isUniqueViolation = (error: unknown) => {
  const code =
    (error as { code?: string })?.code ?? (error as { cause?: { code?: string } })?.cause?.code;
  return code === "23505";
};

// ─── Rules ───────────────────────────────────────────────────────────────────

export async function listRules(exec: Executor, clinicId: string) {
  const trigger = sql<
    string | null
  >`(select ${services.name} from ${services} where ${services.id} = ${followUpRules.triggerServiceId})`;
  return exec
    .select({
      id: followUpRules.id,
      name: followUpRules.name,
      triggerServiceId: followUpRules.triggerServiceId,
      triggerServiceName: trigger,
      visitServiceId: followUpRules.visitServiceId,
      visitServiceName: services.name,
      intervalValue: followUpRules.intervalValue,
      intervalUnit: followUpRules.intervalUnit,
      totalVisits: followUpRules.totalVisits,
      smsReminders: followUpRules.smsReminders,
      isActive: followUpRules.isActive,
      templateKey: followUpRules.templateKey,
      openPlans: sql<number>`(select count(*)::int from ${followUpPlans} where ${followUpPlans.ruleId} = ${followUpRules.id} and ${followUpPlans.state} in ('active', 'paused'))`,
    })
    .from(followUpRules)
    .innerJoin(services, eq(services.id, followUpRules.visitServiceId))
    .where(and(eq(followUpRules.clinicId, clinicId), isNull(followUpRules.archivedAt)))
    .orderBy(asc(followUpRules.name));
}

async function assertServices(exec: Executor, clinicId: string, ids: (string | null)[]) {
  const wanted = [...new Set(ids.filter((id): id is string => id !== null))];
  const found = await exec
    .select({ id: services.id })
    .from(services)
    .where(and(eq(services.clinicId, clinicId), inArray(services.id, wanted)));
  if (found.length !== wanted.length) {
    throw new DomainError("INVALID_SERVICE", "Hizmet bulunamadı.");
  }
}

/** Creates or edits a rule. Existing plans keep their copy (snapshot). */
export async function saveRule(
  exec: Executor,
  clinicId: string,
  ruleId: string | null,
  input: FollowUpRuleInput,
): Promise<string> {
  await assertServices(exec, clinicId, [input.triggerServiceId, input.visitServiceId]);
  const values = {
    name: input.name,
    triggerServiceId: input.triggerServiceId,
    visitServiceId: input.visitServiceId,
    intervalValue: input.intervalValue,
    intervalUnit: input.intervalUnit,
    totalVisits: input.totalVisits,
    smsReminders: input.smsReminders,
    isActive: input.isActive,
  };
  if (!ruleId) {
    const [created] = await exec
      .insert(followUpRules)
      .values({ clinicId, ...values })
      .returning({ id: followUpRules.id });
    return created!.id;
  }
  const updated = await exec
    .update(followUpRules)
    .set(values)
    .where(
      and(
        eq(followUpRules.clinicId, clinicId),
        eq(followUpRules.id, ruleId),
        isNull(followUpRules.archivedAt),
      ),
    )
    .returning({ id: followUpRules.id });
  if (updated.length === 0) throw new DomainError("NOT_FOUND", "Kural bulunamadı.");
  return ruleId;
}

/** Rules are never deleted (plans keep their history); archived ones disappear. */
export async function archiveRule(exec: Executor, clinicId: string, ruleId: string, now: Date) {
  const updated = await exec
    .update(followUpRules)
    .set({ archivedAt: now, isActive: false })
    .where(
      and(
        eq(followUpRules.clinicId, clinicId),
        eq(followUpRules.id, ruleId),
        isNull(followUpRules.archivedAt),
      ),
    )
    .returning({ id: followUpRules.id });
  if (updated.length === 0) throw new DomainError("NOT_FOUND", "Kural bulunamadı.");
}

export async function duplicateRule(exec: Executor, clinicId: string, ruleId: string) {
  const [rule] = await exec
    .select()
    .from(followUpRules)
    .where(and(eq(followUpRules.clinicId, clinicId), eq(followUpRules.id, ruleId)));
  if (!rule) throw new DomainError("NOT_FOUND", "Kural bulunamadı.");
  const [copy] = await exec
    .insert(followUpRules)
    .values({
      clinicId,
      name: `${rule.name} (kopya)`.slice(0, 60),
      triggerServiceId: rule.triggerServiceId,
      visitServiceId: rule.visitServiceId,
      intervalValue: rule.intervalValue,
      intervalUnit: rule.intervalUnit,
      totalVisits: rule.totalVisits,
      smsReminders: rule.smsReminders,
      isActive: false,
    })
    .returning({ id: followUpRules.id });
  return copy!.id;
}

/**
 * Adds the sector's example rules (inactive, no interval) for services the
 * clinic has by name. Already added examples are skipped.
 */
export async function addExampleRules(
  exec: Executor,
  clinicId: string,
  template: ClinicTemplate,
): Promise<number> {
  const examples = FOLLOW_UP_EXAMPLES[template] ?? [];
  if (examples.length === 0) return 0;
  const [clinicServices, existing] = await Promise.all([
    exec
      .select({ id: services.id, name: services.name })
      .from(services)
      .where(eq(services.clinicId, clinicId)),
    exec
      .select({ templateKey: followUpRules.templateKey })
      .from(followUpRules)
      .where(eq(followUpRules.clinicId, clinicId)),
  ]);
  const byName = new Map(clinicServices.map((s) => [s.name.toLocaleLowerCase("tr-TR"), s.id]));
  const taken = new Set(existing.map((r) => r.templateKey));
  const rows = examples.flatMap((example) => {
    const visit = byName.get(example.visitServiceName.toLocaleLowerCase("tr-TR"));
    if (!visit || taken.has(example.key)) return [];
    const trigger = example.triggerServiceName
      ? (byName.get(example.triggerServiceName.toLocaleLowerCase("tr-TR")) ?? null)
      : null;
    return [
      {
        clinicId,
        name: example.name,
        triggerServiceId: trigger,
        visitServiceId: visit,
        intervalValue: null,
        intervalUnit: null,
        totalVisits: example.totalVisits ?? null,
        isActive: false,
        templateKey: example.key,
      },
    ];
  });
  if (rows.length > 0) await exec.insert(followUpRules).values(rows);
  return rows.length;
}

// ─── Plan calculation ────────────────────────────────────────────────────────

export interface PlanVisitRow {
  id: string;
  source: string;
  appointmentId: string | null;
  appointmentStatus: string | null;
  startsAt: Date | null;
  status: VisitStatus;
}

async function loadVisits(
  exec: Executor,
  scope: FollowUpScope,
  planIds: string[],
  now: Date,
): Promise<Map<string, PlanVisitRow[]>> {
  const result = new Map<string, PlanVisitRow[]>();
  if (planIds.length === 0) return result;
  const rows = await exec
    .select({
      id: followUpVisits.id,
      planId: followUpVisits.planId,
      source: followUpVisits.source,
      visitedOn: followUpVisits.visitedOn,
      appointmentId: followUpVisits.appointmentId,
      appointmentStatus: appointments.status,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
    })
    .from(followUpVisits)
    .leftJoin(
      appointments,
      and(
        eq(appointments.clinicId, followUpVisits.clinicId),
        eq(appointments.id, followUpVisits.appointmentId),
      ),
    )
    .where(
      and(eq(followUpVisits.clinicId, scope.clinicId), inArray(followUpVisits.planId, planIds)),
    )
    .orderBy(asc(followUpVisits.createdAt));
  for (const row of rows) {
    const status = classifyVisit({
      appointment:
        row.appointmentId && row.appointmentStatus && row.startsAt && row.endsAt
          ? {
              status: row.appointmentStatus,
              startsOn: utcToLocal(row.startsAt, scope.timeZone).date,
              ended: row.endsAt.getTime() <= now.getTime(),
            }
          : null,
      visitedOn: row.visitedOn,
    });
    const list = result.get(row.planId) ?? [];
    list.push({
      id: row.id,
      source: row.source,
      appointmentId: row.appointmentId,
      appointmentStatus: row.appointmentStatus,
      startsAt: row.startsAt,
      status,
    });
    result.set(row.planId, list);
  }
  return result;
}

function outcomeFor(plan: FollowUpPlan, visits: PlanVisitRow[], scope: FollowUpScope) {
  return computeFollowUp(
    {
      state: plan.state,
      startedOn: plan.startedOn,
      intervalValue: plan.intervalValue,
      intervalUnit: plan.intervalUnit,
      totalVisits: plan.totalVisits,
      dueOverrideOn: plan.dueOverrideOn,
      dueOverrideSetOn: plan.dueOverrideAt
        ? utcToLocal(plan.dueOverrideAt, scope.timeZone).date
        : null,
    },
    visits.map((v) => v.status),
  );
}

/** Recalculates plans and stores the cache columns. Returns outcomes by plan id. */
export async function recomputePlans(
  exec: Executor,
  scope: FollowUpScope,
  planIds: string[],
  now: Date,
): Promise<Map<string, PlanOutcome>> {
  const outcomes = new Map<string, PlanOutcome>();
  if (planIds.length === 0) return outcomes;
  const plans = await exec
    .select()
    .from(followUpPlans)
    .where(and(eq(followUpPlans.clinicId, scope.clinicId), inArray(followUpPlans.id, planIds)));
  const visits = await loadVisits(
    exec,
    scope,
    plans.map((p) => p.id),
    now,
  );
  for (const plan of plans) {
    const outcome = outcomeFor(plan, visits.get(plan.id) ?? [], scope);
    outcomes.set(plan.id, outcome);
    await exec
      .update(followUpPlans)
      .set({
        state: outcome.state,
        nextDueOn: outcome.nextDueOn,
        visitsDone: outcome.visitsDone,
        ...(outcome.state !== plan.state && { stateChangedAt: now }),
        updatedAt: now,
      })
      .where(and(eq(followUpPlans.clinicId, scope.clinicId), eq(followUpPlans.id, plan.id)));
  }
  return outcomes;
}

/** After an appointment changed (status, cancel, reschedule): its plans follow. */
export async function recomputePlansForAppointment(
  exec: Executor,
  scope: FollowUpScope,
  appointmentId: string,
  now: Date,
) {
  const rows = await exec
    .select({ planId: followUpVisits.planId })
    .from(followUpVisits)
    .where(
      and(
        eq(followUpVisits.clinicId, scope.clinicId),
        eq(followUpVisits.appointmentId, appointmentId),
      ),
    );
  await recomputePlans(
    exec,
    scope,
    rows.map((r) => r.planId),
    now,
  );
}

/**
 * Plans whose linked appointment ended after their last recalculation: a
 * passed appointment counts by time alone (decision 1), with no event to
 * trigger it. Called by the daily job and when the Takip tab loads.
 */
export async function recomputeStalePlans(exec: Executor, scope: FollowUpScope, now: Date) {
  const stale = await exec
    .selectDistinct({ id: followUpPlans.id })
    .from(followUpPlans)
    .innerJoin(
      followUpVisits,
      and(
        eq(followUpVisits.clinicId, followUpPlans.clinicId),
        eq(followUpVisits.planId, followUpPlans.id),
      ),
    )
    .innerJoin(
      appointments,
      and(
        eq(appointments.clinicId, followUpVisits.clinicId),
        eq(appointments.id, followUpVisits.appointmentId),
      ),
    )
    .where(
      and(
        eq(followUpPlans.clinicId, scope.clinicId),
        inArray(followUpPlans.state, ["active", "paused"]),
        inArray(appointments.status, [...ACTIVE_APPOINTMENT_STATUSES]),
        lt(appointments.endsAt, now),
        gt(appointments.endsAt, followUpPlans.updatedAt),
      ),
    );
  await recomputePlans(
    exec,
    scope,
    stale.map((p) => p.id),
    now,
  );
  return stale.length;
}

// ─── Appointment linking (§E) ────────────────────────────────────────────────

/**
 * Links a new appointment to the patient's plan for its service, but only
 * when exactly one plan can take it. Several candidates are flagged for
 * staff instead; nothing is attached silently to the wrong plan.
 */
export async function autoLinkAppointment(
  exec: Executor,
  scope: FollowUpScope,
  appointment: { id: string; patientId: string; serviceId: string },
  now: Date,
): Promise<{ linkedPlanId: string | null; ambiguous: boolean }> {
  const candidates = await exec
    .select({ id: followUpPlans.id })
    .from(followUpPlans)
    .where(
      and(
        eq(followUpPlans.clinicId, scope.clinicId),
        eq(followUpPlans.patientId, appointment.patientId),
        eq(followUpPlans.visitServiceId, appointment.serviceId),
        eq(followUpPlans.state, "active"),
        // Not already booked: no linked future active appointment.
        sql`not exists (
          select 1 from ${followUpVisits} v
          join ${appointments} a on a.clinic_id = v.clinic_id and a.id = v.appointment_id
          where v.plan_id = ${followUpPlans.id}
            and a.id <> ${appointment.id}
            and a.status in ('scheduled', 'confirmed')
            and a.ends_at > ${now}
        )`,
      ),
    );
  if (candidates.length === 0) return { linkedPlanId: null, ambiguous: false };
  if (candidates.length > 1) {
    await exec
      .update(followUpPlans)
      .set({ needsReview: true })
      .where(
        and(
          eq(followUpPlans.clinicId, scope.clinicId),
          inArray(
            followUpPlans.id,
            candidates.map((c) => c.id),
          ),
        ),
      );
    return { linkedPlanId: null, ambiguous: true };
  }
  const planId = candidates[0]!.id;
  const inserted = await exec
    .insert(followUpVisits)
    .values({
      clinicId: scope.clinicId,
      planId,
      appointmentId: appointment.id,
      source: "auto_link",
    })
    .onConflictDoNothing({ target: followUpVisits.appointmentId })
    .returning({ id: followUpVisits.id });
  if (inserted.length === 0) return { linkedPlanId: null, ambiguous: false };
  await recomputePlans(exec, scope, [planId], now);
  return { linkedPlanId: planId, ambiguous: false };
}

/** Rescheduling creates a new appointment; the follow-up link moves with it. */
export async function moveFollowUpLink(
  exec: Executor,
  scope: FollowUpScope,
  fromAppointmentId: string,
  toAppointmentId: string,
  now: Date,
) {
  const moved = await exec
    .update(followUpVisits)
    .set({ appointmentId: toAppointmentId })
    .where(
      and(
        eq(followUpVisits.clinicId, scope.clinicId),
        eq(followUpVisits.appointmentId, fromAppointmentId),
      ),
    )
    .returning({ planId: followUpVisits.planId });
  await recomputePlans(
    exec,
    scope,
    moved.map((m) => m.planId),
    now,
  );
}

// ─── Plans ───────────────────────────────────────────────────────────────────

async function getPlanRow(exec: Executor, clinicId: string, planId: string) {
  const [plan] = await exec
    .select()
    .from(followUpPlans)
    .where(and(eq(followUpPlans.clinicId, clinicId), eq(followUpPlans.id, planId)));
  if (!plan) throw new DomainError("NOT_FOUND", "Takip bulunamadı.");
  return plan;
}

async function skipPendingReminders(exec: Executor, clinicId: string, planId: string) {
  await exec
    .update(notifications)
    .set({ status: "skipped", skipReason: "subject_changed", lockedAt: null })
    .where(
      and(
        eq(notifications.clinicId, clinicId),
        eq(notifications.subjectId, planId),
        eq(notifications.status, "pending"),
      ),
    );
}

export async function startPlan(
  exec: Executor,
  scope: FollowUpScope,
  actorUserId: string | null,
  input: StartPlanInput,
  now: Date,
): Promise<string> {
  const [rule] = await exec
    .select()
    .from(followUpRules)
    .where(
      and(
        eq(followUpRules.clinicId, scope.clinicId),
        eq(followUpRules.id, input.ruleId),
        eq(followUpRules.isActive, true),
        isNull(followUpRules.archivedAt),
      ),
    );
  if (!rule || rule.intervalValue === null || rule.intervalUnit === null) {
    throw new DomainError("NOT_FOUND", "Etkin bir takip kuralı seçin.");
  }
  const [patient] = await exec
    .select({ id: patients.id, phone: patients.phone })
    .from(patients)
    .where(and(eq(patients.clinicId, scope.clinicId), eq(patients.id, input.patientId)));
  if (!patient || patient.phone.startsWith("anon:")) {
    throw new DomainError("NOT_FOUND", "Hasta bulunamadı.");
  }

  let startedOn: LocalDate = input.startedOn ?? localToday(now, scope.timeZone);
  if (input.appointmentId) {
    const [appointment] = await exec
      .select({ startsAt: appointments.startsAt, patientId: appointments.patientId })
      .from(appointments)
      .where(
        and(eq(appointments.clinicId, scope.clinicId), eq(appointments.id, input.appointmentId)),
      );
    if (!appointment || appointment.patientId !== patient.id) {
      throw new DomainError("NOT_FOUND", "Randevu bulunamadı.");
    }
    startedOn = utcToLocal(appointment.startsAt, scope.timeZone).date;
  }

  let planId: string;
  try {
    const [plan] = await exec
      .insert(followUpPlans)
      .values({
        clinicId: scope.clinicId,
        patientId: patient.id,
        ruleId: rule.id,
        name: rule.name,
        visitServiceId: rule.visitServiceId,
        intervalValue: rule.intervalValue,
        intervalUnit: rule.intervalUnit,
        totalVisits: rule.totalVisits,
        startedOn,
        smsConsentAt: input.smsConsent ? now : null,
        smsConsentBy: input.smsConsent ? actorUserId : null,
      })
      .returning({ id: followUpPlans.id });
    planId = plan!.id;
    if (input.appointmentId) {
      await exec.insert(followUpVisits).values({
        clinicId: scope.clinicId,
        planId,
        appointmentId: input.appointmentId,
        source: "start",
        createdBy: actorUserId,
      });
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DomainError(
        "FOLLOW_UP_EXISTS",
        input.appointmentId
          ? "Bu randevu zaten bir takibe bağlı ya da hastanın bu kuralda açık takibi var."
          : "Hastanın bu kuralda zaten açık bir takibi var.",
      );
    }
    throw error;
  }
  await recomputePlans(exec, scope, [planId], now);
  return planId;
}

/** Staff actions on a plan (§E rows 10–20). Audit is written by the caller. */
export async function applyPlanAction(
  exec: Executor,
  scope: FollowUpScope,
  actorUserId: string | null,
  action: PlanAction,
  now: Date,
): Promise<void> {
  const plan = await getPlanRow(exec, scope.clinicId, action.planId);
  const where = and(eq(followUpPlans.clinicId, scope.clinicId), eq(followUpPlans.id, plan.id));
  const open = plan.state === "active" || plan.state === "paused";

  switch (action.type) {
    case "pause":
      if (plan.state !== "active") throw invalid("Yalnızca etkin bir takip duraklatılabilir.");
      await exec.update(followUpPlans).set({ state: "paused", stateChangedAt: now }).where(where);
      await skipPendingReminders(exec, scope.clinicId, plan.id);
      return;
    case "resume":
      if (plan.state !== "paused") throw invalid("Bu takip duraklatılmamış.");
      await exec.update(followUpPlans).set({ state: "active", stateChangedAt: now }).where(where);
      break;
    case "stop":
      if (!open) throw invalid("Bu takip zaten kapanmış.");
      await exec
        .update(followUpPlans)
        .set({
          state: "stopped",
          stoppedReason: action.reason,
          stateChangedAt: now,
          nextDueOn: null,
          needsReview: false,
        })
        .where(where);
      await skipPendingReminders(exec, scope.clinicId, plan.id);
      return;
    case "set_due":
      if (!open) throw invalid("Kapanmış takipte tarih değiştirilemez.");
      await exec
        .update(followUpPlans)
        .set({ dueOverrideOn: action.dueOn, dueOverrideAt: now })
        .where(where);
      await skipPendingReminders(exec, scope.clinicId, plan.id);
      break;
    case "clear_due":
      await exec
        .update(followUpPlans)
        .set({ dueOverrideOn: null, dueOverrideAt: null })
        .where(where);
      break;
    case "record_visit":
      await exec.insert(followUpVisits).values({
        clinicId: scope.clinicId,
        planId: plan.id,
        visitedOn: action.visitedOn,
        source: "manual",
        createdBy: actorUserId,
      });
      break;
    case "link": {
      const [appointment] = await exec
        .select({ patientId: appointments.patientId })
        .from(appointments)
        .where(
          and(eq(appointments.clinicId, scope.clinicId), eq(appointments.id, action.appointmentId)),
        );
      if (!appointment || appointment.patientId !== plan.patientId) {
        throw new DomainError("NOT_FOUND", "Randevu bu hastaya ait değil.");
      }
      try {
        await exec.insert(followUpVisits).values({
          clinicId: scope.clinicId,
          planId: plan.id,
          appointmentId: action.appointmentId,
          source: "staff_link",
          createdBy: actorUserId,
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new DomainError("FOLLOW_UP_EXISTS", "Bu randevu başka bir takibe bağlı.");
        }
        throw error;
      }
      // The staff decision resolves the ambiguity for this patient and service.
      await exec
        .update(followUpPlans)
        .set({ needsReview: false })
        .where(
          and(
            eq(followUpPlans.clinicId, scope.clinicId),
            eq(followUpPlans.patientId, plan.patientId),
            eq(followUpPlans.visitServiceId, plan.visitServiceId),
          ),
        );
      await skipPendingReminders(exec, scope.clinicId, plan.id);
      break;
    }
    case "unlink": {
      const removed = await exec
        .delete(followUpVisits)
        .where(
          and(
            eq(followUpVisits.clinicId, scope.clinicId),
            eq(followUpVisits.planId, plan.id),
            eq(followUpVisits.appointmentId, action.appointmentId),
          ),
        )
        .returning({ id: followUpVisits.id });
      if (removed.length === 0) throw new DomainError("NOT_FOUND", "Bağlantı bulunamadı.");
      break;
    }
    case "consent":
      await exec
        .update(followUpPlans)
        .set(
          action.granted
            ? { smsConsentAt: now, smsConsentBy: actorUserId }
            : { smsConsentAt: null, smsConsentBy: null },
        )
        .where(where);
      if (!action.granted) await skipPendingReminders(exec, scope.clinicId, plan.id);
      return;
  }
  await recomputePlans(exec, scope, [plan.id], now);
}

function invalid(message: string) {
  return new DomainError("INVALID_TRANSITION", message);
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export interface FollowUpListRow {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  name: string;
  visitServiceId: string;
  state: FollowUpPlan["state"];
  view: FollowUpView;
  nextDueOn: LocalDate | null;
  visitsDone: number;
  totalVisits: number | null;
  needsReview: boolean;
  smsConsent: boolean;
  bookedAt: Date | null;
}

/** The Takip tab: all plans with their bucket, refreshed for time-based changes first. */
export async function listPlans(
  exec: Executor,
  scope: FollowUpScope,
  now: Date,
  dueSoonDays: number,
): Promise<FollowUpListRow[]> {
  await recomputeStalePlans(exec, scope, now);
  const today = localToday(now, scope.timeZone);
  const bookedAt = sql<Date | null>`(
    select min(a.starts_at) from ${followUpVisits} v
    join ${appointments} a on a.clinic_id = v.clinic_id and a.id = v.appointment_id
    where v.plan_id = ${followUpPlans.id}
      and a.status in ('scheduled', 'confirmed')
      and a.ends_at > ${now}
  )`.mapWith((value) => (value ? new Date(value as string) : null));
  const rows = await exec
    .select({
      id: followUpPlans.id,
      patientId: followUpPlans.patientId,
      patientName: patients.fullName,
      patientPhone: patients.phone,
      name: followUpPlans.name,
      visitServiceId: followUpPlans.visitServiceId,
      state: followUpPlans.state,
      nextDueOn: followUpPlans.nextDueOn,
      visitsDone: followUpPlans.visitsDone,
      totalVisits: followUpPlans.totalVisits,
      needsReview: followUpPlans.needsReview,
      smsConsentAt: followUpPlans.smsConsentAt,
      bookedAt,
    })
    .from(followUpPlans)
    .innerJoin(
      patients,
      and(eq(patients.clinicId, followUpPlans.clinicId), eq(patients.id, followUpPlans.patientId)),
    )
    .where(eq(followUpPlans.clinicId, scope.clinicId))
    .orderBy(asc(followUpPlans.nextDueOn), asc(patients.fullName));
  return rows.map((row) => ({
    id: row.id,
    patientId: row.patientId,
    patientName: row.patientName,
    patientPhone: row.patientPhone,
    name: row.name,
    visitServiceId: row.visitServiceId,
    state: row.state,
    view: followUpView(
      { state: row.state, nextDueOn: row.nextDueOn, booked: row.bookedAt !== null },
      today,
      dueSoonDays,
    ),
    nextDueOn: row.nextDueOn,
    visitsDone: row.visitsDone,
    totalVisits: row.totalVisits,
    needsReview: row.needsReview,
    smsConsent: row.smsConsentAt !== null,
    bookedAt: row.bookedAt,
  }));
}

export async function getPlanDetail(
  exec: Executor,
  scope: FollowUpScope,
  planId: string,
  now: Date,
) {
  await recomputePlans(exec, scope, [planId], now);
  const plan = await getPlanRow(exec, scope.clinicId, planId);
  const [[patient], [service], visits, reminders] = await Promise.all([
    exec
      .select({
        id: patients.id,
        fullName: patients.fullName,
        phone: patients.phone,
        smsOptOutAt: patients.smsOptOutAt,
      })
      .from(patients)
      .where(and(eq(patients.clinicId, scope.clinicId), eq(patients.id, plan.patientId))),
    exec
      .select({ name: services.name })
      .from(services)
      .where(and(eq(services.clinicId, scope.clinicId), eq(services.id, plan.visitServiceId))),
    loadVisits(exec, scope, [plan.id], now),
    exec
      .select({
        status: notifications.status,
        skipReason: notifications.skipReason,
        createdAt: notifications.createdAt,
        sentAt: notifications.sentAt,
      })
      .from(notifications)
      .where(and(eq(notifications.clinicId, scope.clinicId), eq(notifications.subjectId, plan.id)))
      .orderBy(desc(notifications.createdAt)),
  ]);
  const visitRows = visits.get(plan.id) ?? [];
  const outcome = outcomeFor(plan, visitRows, scope);
  return {
    plan,
    patient: patient!,
    visitServiceName: service?.name ?? "",
    visits: visitRows,
    reminders,
    outcome,
  };
}

/** Plans of one patient, for the patient page. */
export async function listPatientPlans(exec: Executor, clinicId: string, patientId: string) {
  return exec
    .select({
      id: followUpPlans.id,
      name: followUpPlans.name,
      state: followUpPlans.state,
      nextDueOn: followUpPlans.nextDueOn,
      visitsDone: followUpPlans.visitsDone,
      totalVisits: followUpPlans.totalVisits,
    })
    .from(followUpPlans)
    .where(and(eq(followUpPlans.clinicId, clinicId), eq(followUpPlans.patientId, patientId)))
    .orderBy(desc(followUpPlans.createdAt));
}

/** The appointment's plan, if linked (appointment detail page). */
export async function planForAppointment(exec: Executor, clinicId: string, appointmentId: string) {
  const [row] = await exec
    .select({
      planId: followUpVisits.planId,
      name: followUpPlans.name,
      source: followUpVisits.source,
    })
    .from(followUpVisits)
    .innerJoin(
      followUpPlans,
      and(
        eq(followUpPlans.clinicId, followUpVisits.clinicId),
        eq(followUpPlans.id, followUpVisits.planId),
      ),
    )
    .where(
      and(eq(followUpVisits.clinicId, clinicId), eq(followUpVisits.appointmentId, appointmentId)),
    );
  return row ?? null;
}

/** Active rules to offer when starting a plan. */
export async function listActiveRules(exec: Executor, clinicId: string) {
  return exec
    .select({
      id: followUpRules.id,
      name: followUpRules.name,
      triggerServiceId: followUpRules.triggerServiceId,
      visitServiceId: followUpRules.visitServiceId,
      smsReminders: followUpRules.smsReminders,
    })
    .from(followUpRules)
    .where(
      and(
        eq(followUpRules.clinicId, clinicId),
        eq(followUpRules.isActive, true),
        isNull(followUpRules.archivedAt),
      ),
    )
    .orderBy(asc(followUpRules.name));
}

/** The patient's appointments not tied to any plan, for manual linking (newest first). */
export async function listLinkableAppointments(
  exec: Executor,
  scope: FollowUpScope,
  patientId: string,
) {
  const rows = await exec
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      status: appointments.status,
      serviceName: services.name,
    })
    .from(appointments)
    .innerJoin(
      services,
      and(eq(services.clinicId, appointments.clinicId), eq(services.id, appointments.serviceId)),
    )
    .where(
      and(
        eq(appointments.clinicId, scope.clinicId),
        eq(appointments.patientId, patientId),
        sql`${appointments.status} <> 'cancelled'`,
        sql`not exists (select 1 from ${followUpVisits} v where v.appointment_id = ${appointments.id})`,
      ),
    )
    .orderBy(desc(appointments.startsAt))
    .limit(20);
  return rows.map((row) => ({
    id: row.id,
    label: `${utcToLocal(row.startsAt, scope.timeZone).date} ${utcToLocal(row.startsAt, scope.timeZone).time} · ${row.serviceName}`,
    status: row.status,
  }));
}
