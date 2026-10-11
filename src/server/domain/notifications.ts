import "server-only";

import {
  and,
  asc,
  count,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  lt,
  lte,
  notInArray,
  sql,
} from "drizzle-orm";

import { ACTIVE_APPOINTMENT_STATUSES } from "@/lib/contracts/appointment";
import type { SkipReason } from "@/lib/contracts/notification";
import { normalizePhone } from "@/lib/phone";

import type { Database, Executor } from "../db";
import {
  appointments,
  clinics,
  followUpPlans,
  followUpRules,
  followUpVisits,
  notifications,
  patients,
  type Notification,
} from "../db/schema";
import type { SmsProvider } from "../notifications/sms";
import { SMS_TEMPLATE_KEYS, smsTemplates } from "../notifications/sms";
import { parseClinicSettings, type ClinicSettings } from "./clinic-settings";
import { REMINDER_OFFSETS_DAYS } from "./follow-up-logic";
import { recomputeStalePlans } from "./follow-ups";
import { patientsPerName } from "./patients-per-name";
import { beginRun, endRun, finishedClinicIds, recordClinic, type RunStatus } from "./job-runs";
import { addLocalDays, localToday, localToUtc, utcToLocal, timeToMinutes } from "./time";

/**
 * Notification log (docs/proposals/TAKIP.md, V0): plan → send, per clinic.
 * Planning is idempotent (unique dedupe key); sending is at most once (a row
 * stuck in "sending" becomes "unknown" and is never retried).
 */

export const MAX_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 60 * 60 * 1000;
export const STALE_SENDING_MS = 15 * 60 * 1000;
/** Clinic-local hours in which messages may go out. */
export const SEND_WINDOW = { from: 9 * 60, until: 20 * 60 } as const;
/** Cost guard until per-clinic limits exist (V1). */
export const DAILY_SMS_CAP_PER_CLINIC = 100;
/** Reminders: one per patient per day. Messages the caller triggered: a loop guard. */
export const DAILY_REMINDERS_PER_PATIENT = 1;
export const DAILY_TRANSACTIONAL_PER_PATIENT = 5;

export type AppointmentMessageKind = Extract<
  Notification["kind"],
  "appointment_confirmation" | "appointment_cancellation" | "appointment_rescheduled"
>;

const TRANSACTIONAL_KINDS: readonly Notification["kind"][] = [
  "appointment_confirmation",
  "appointment_cancellation",
  "appointment_rescheduled",
];

const TRANSACTIONAL_TEMPLATE: Record<AppointmentMessageKind, string> = {
  appointment_confirmation: SMS_TEMPLATE_KEYS.appointmentConfirmation,
  appointment_cancellation: SMS_TEMPLATE_KEYS.appointmentCancellation,
  appointment_rescheduled: SMS_TEMPLATE_KEYS.appointmentRescheduled,
};
const DISPATCH_BATCH = 200;

interface ClinicRow {
  id: string;
  name: string;
  timezone: string;
  /** Shown in the booking confirmation. */
  address?: string | null;
  settings: ClinicSettings;
}

export function appointmentReminderKey(appointmentId: string, startsAt: Date): string {
  return `appt:${appointmentId}:${startsAt.getTime()}`;
}

/** UTC bounds of a clinic-local day. */
function localDayRange(date: string, timeZone: string) {
  return {
    start: localToUtc(date, 0, timeZone),
    end: localToUtc(addLocalDays(date, 1), 0, timeZone),
  };
}

export function isInSendWindow(now: Date, timeZone: string): boolean {
  const minute = timeToMinutes(utcToLocal(now, timeZone).time);
  return minute >= SEND_WINDOW.from && minute < SEND_WINDOW.until;
}

/**
 * Appointment reminders for one clinic. The job runs once a day (Vercel
 * Hobby), so the reminder goes out the day before. An appointment that is
 * already today and was never planned (booked after yesterday's run) is
 * recorded as skipped "too_late" instead of being dropped silently.
 */
export async function planAppointmentReminders(
  exec: Executor,
  clinic: ClinicRow,
  now: Date,
): Promise<{ planned: number; tooLate: number }> {
  if (clinic.settings.notifications.smsReminderHoursBefore === null) {
    return { planned: 0, tooLate: 0 };
  }
  const today = localToday(now, clinic.timezone);
  const active = inArray(appointments.status, [...ACTIVE_APPOINTMENT_STATUSES]);

  const due = async (date: string) => {
    const { start, end } = localDayRange(date, clinic.timezone);
    return exec
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        startsAt: appointments.startsAt,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.clinicId, clinic.id),
          active,
          gte(appointments.startsAt, start),
          lt(appointments.startsAt, end),
        ),
      );
  };

  const row = (
    appointment: { id: string; patientId: string; startsAt: Date },
    skip: SkipReason | null,
  ) => ({
    clinicId: clinic.id,
    patientId: appointment.patientId,
    kind: "appointment_reminder" as const,
    subjectId: appointment.id,
    dedupeKey: appointmentReminderKey(appointment.id, appointment.startsAt),
    templateKey: SMS_TEMPLATE_KEYS.appointmentReminder,
    status: skip ? ("skipped" as const) : ("pending" as const),
    skipReason: skip,
    scheduledFor: now,
  });

  const tomorrow = await due(addLocalDays(today, 1));
  const planned = tomorrow.length
    ? await exec
        .insert(notifications)
        .values(tomorrow.map((a) => row(a, null)))
        .onConflictDoNothing({ target: notifications.dedupeKey })
        .returning({ id: notifications.id })
    : [];

  const todays = await due(today);
  const tooLate = todays.length
    ? await exec
        .insert(notifications)
        .values(todays.map((a) => row(a, "too_late")))
        .onConflictDoNothing({ target: notifications.dedupeKey })
        .returning({ id: notifications.id })
    : [];

  return { planned: planned.length, tooLate: tooLate.length };
}

/** Below this, a reminder is no longer worth sending (recorded as "too_late"). */
export const REMINDER_MIN_LEAD_MS = 60 * 60 * 1000;

/**
 * Hourly reminders (HOURLY_REMINDERS, R2 5b; needs an hourly cron, so
 * Vercel Pro). An appointment is planned when it enters the clinic's window
 * (`smsReminderHoursBefore`), or at the next run when it was booked inside
 * it; with less than an hour to go it is recorded as too late. The dedupe key
 * is the daily planner's, so no appointment is reminded twice.
 */
export async function planDueReminders(
  exec: Executor,
  clinic: ClinicRow,
  now: Date,
): Promise<{ planned: number; tooLate: number }> {
  const hours = clinic.settings.notifications.smsReminderHoursBefore;
  if (hours === null) return { planned: 0, tooLate: 0 };
  const due = await exec
    .select({
      id: appointments.id,
      patientId: appointments.patientId,
      startsAt: appointments.startsAt,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.clinicId, clinic.id),
        inArray(appointments.status, [...ACTIVE_APPOINTMENT_STATUSES]),
        gt(appointments.startsAt, now),
        lte(appointments.startsAt, new Date(now.getTime() + hours * 60 * 60 * 1000)),
      ),
    );
  if (due.length === 0) return { planned: 0, tooLate: 0 };
  const rows = due.map((appointment) => {
    const late = appointment.startsAt.getTime() - now.getTime() < REMINDER_MIN_LEAD_MS;
    return {
      clinicId: clinic.id,
      patientId: appointment.patientId,
      kind: "appointment_reminder" as const,
      subjectId: appointment.id,
      dedupeKey: appointmentReminderKey(appointment.id, appointment.startsAt),
      templateKey: SMS_TEMPLATE_KEYS.appointmentReminder,
      status: late ? ("skipped" as const) : ("pending" as const),
      skipReason: late ? ("too_late" as const) : null,
      scheduledFor: now,
    };
  });
  const inserted = await exec
    .insert(notifications)
    .values(rows)
    .onConflictDoNothing({ target: notifications.dedupeKey })
    .returning({ status: notifications.status });
  return {
    planned: inserted.filter((row) => row.status === "pending").length,
    tooLate: inserted.filter((row) => row.status === "skipped").length,
  };
}

/** One clinic's hourly reminder pass: plan what is due, then send it (locks apply). */
export async function runHourlyReminders(
  db: Database,
  deps: DispatchDeps,
  log: (failure: { clinicId: string; error: unknown }) => void = () => {},
): Promise<{ clinics: number; planned: number; tooLate: number; failedClinics: number }> {
  const result = { clinics: 0, planned: 0, tooLate: 0, failedClinics: 0 };
  const rows = await db
    .select({
      id: clinics.id,
      name: clinics.name,
      timezone: clinics.timezone,
      address: clinics.address,
      settings: clinics.settings,
    })
    .from(clinics)
    .orderBy(asc(clinics.createdAt));
  for (const row of rows) {
    result.clinics += 1;
    try {
      const clinic: ClinicRow = { ...row, settings: parseClinicSettings(row.settings) };
      const plan = await planDueReminders(db, clinic, deps.now);
      result.planned += plan.planned;
      result.tooLate += plan.tooLate;
      await dispatchNotifications(db, clinic, deps);
    } catch (error) {
      result.failedClinics += 1;
      log({ clinicId: row.id, error });
    }
  }
  return result;
}

/**
 * Records a message about an appointment the caller just booked, cancelled or
 * moved. Nothing is sent here: the dispatcher sends it with every lock, the
 * opt-out, the send window and the caps, like any other message.
 * Returns whether it can reach the patient as things stand (not opted out).
 */
export async function enqueueAppointmentMessage(
  exec: Executor,
  input: {
    clinicId: string;
    kind: AppointmentMessageKind;
    appointmentId: string;
    patientId: string;
    now: Date;
  },
): Promise<{ queued: boolean; optedOut: boolean }> {
  const [patient] = await exec
    .select({ phone: patients.phone, smsOptOutAt: patients.smsOptOutAt })
    .from(patients)
    .where(and(eq(patients.clinicId, input.clinicId), eq(patients.id, input.patientId)));
  const inserted = await exec
    .insert(notifications)
    .values({
      clinicId: input.clinicId,
      patientId: input.patientId,
      kind: input.kind,
      subjectId: input.appointmentId,
      dedupeKey: `${input.kind}:${input.appointmentId}`,
      templateKey: TRANSACTIONAL_TEMPLATE[input.kind],
      scheduledFor: input.now,
    })
    .onConflictDoNothing({ target: notifications.dedupeKey })
    .returning({ id: notifications.id });
  return {
    queued: inserted.length > 0,
    optedOut: patient ? await isOptedOut(exec, input.clinicId, patient) : false,
  };
}

/**
 * Whether messages to this patient are opted out. With PATIENTS_PER_NAME the
 * opt-out follows the number (P-12): family members share the phone, and a
 * "stop" from any of them stops messages to it. Off: the patient's own flag.
 */
async function isOptedOut(
  exec: Executor,
  clinicId: string,
  patient: { phone: string; smsOptOutAt: Date | null },
  perName: boolean = patientsPerName(),
): Promise<boolean> {
  if (patient.smsOptOutAt) return true;
  if (!perName) return false;
  const [other] = await exec
    .select({ id: patients.id })
    .from(patients)
    .where(
      and(
        eq(patients.clinicId, clinicId),
        eq(patients.phone, patient.phone),
        isNotNull(patients.smsOptOutAt),
      ),
    )
    .limit(1);
  return Boolean(other);
}

/** Sends one clinic's due messages right away (after a call's tool runs). */
export async function dispatchClinicNotifications(
  db: Database,
  clinicId: string,
  deps: DispatchDeps,
): Promise<DispatchResult | null> {
  const [row] = await db
    .select({
      id: clinics.id,
      name: clinics.name,
      timezone: clinics.timezone,
      address: clinics.address,
      settings: clinics.settings,
    })
    .from(clinics)
    .where(eq(clinics.id, clinicId));
  if (!row) return null;
  return dispatchNotifications(db, { ...row, settings: parseClinicSettings(row.settings) }, deps);
}

export function followUpReminderKey(planId: string, dueOn: string, n: number): string {
  return `fu:${planId}:${dueOn}:${n}`;
}

/**
 * Follow-up reminders (TAKIP.md §K): a week before the due date, and two
 * weeks after it if the plan is still not booked. Only plans with SMS
 * consent whose rule sends SMS; the dedupe key ties a row to one due date.
 */
export async function planFollowUpReminders(
  exec: Executor,
  clinic: ClinicRow,
  now: Date,
): Promise<number> {
  if (!clinic.settings.features.followUp || !clinic.settings.followUp.smsReminders) return 0;
  const today = localToday(now, clinic.timezone);
  const plans = await exec
    .select({
      id: followUpPlans.id,
      patientId: followUpPlans.patientId,
      nextDueOn: followUpPlans.nextDueOn,
    })
    .from(followUpPlans)
    .innerJoin(
      followUpRules,
      and(
        eq(followUpRules.clinicId, followUpPlans.clinicId),
        eq(followUpRules.id, followUpPlans.ruleId),
      ),
    )
    .where(
      and(
        eq(followUpPlans.clinicId, clinic.id),
        eq(followUpPlans.state, "active"),
        isNotNull(followUpPlans.smsConsentAt),
        isNotNull(followUpPlans.nextDueOn),
        eq(followUpRules.smsReminders, true),
        sql`not exists (
          select 1 from ${followUpVisits} v
          join ${appointments} a on a.clinic_id = v.clinic_id and a.id = v.appointment_id
          where v.plan_id = ${followUpPlans.id}
            and a.status in ('scheduled', 'confirmed') and a.ends_at > ${now}
        )`,
      ),
    );
  const rows = plans.flatMap((plan) => {
    const due = plan.nextDueOn!;
    const [first, second] = REMINDER_OFFSETS_DAYS.map((offset) => addLocalDays(due, offset));
    // Only the latest reminder that applies; a late start never sends both.
    const n = today >= second! ? 2 : today >= first! ? 1 : 0;
    if (n === 0) return [];
    return [
      {
        clinicId: clinic.id,
        patientId: plan.patientId,
        kind: "follow_up_reminder" as const,
        subjectId: plan.id,
        dedupeKey: followUpReminderKey(plan.id, due, n),
        templateKey: SMS_TEMPLATE_KEYS.followUpReminder,
        scheduledFor: now,
      },
    ];
  });
  if (rows.length === 0) return 0;
  const inserted = await exec
    .insert(notifications)
    .values(rows)
    .onConflictDoNothing({ target: notifications.dedupeKey })
    .returning({ id: notifications.id });
  return inserted.length;
}

export interface DispatchDeps {
  now: Date;
  /** SMS_SENDING_ENABLED; false means no provider is ever called. */
  sendingEnabled: boolean;
  provider: SmsProvider;
  providerName: string;
}

export type DispatchResult = Record<"sent" | "failed" | "retried" | "skipped" | "unknown", number>;

/** Sends one clinic's due messages. Never touches another clinic's rows. */
export async function dispatchNotifications(
  db: Database,
  clinic: ClinicRow,
  deps: DispatchDeps,
): Promise<DispatchResult> {
  const result: DispatchResult = { sent: 0, failed: 0, retried: 0, skipped: 0, unknown: 0 };
  const { now } = deps;

  // A send that started and never reported back: outcome unknown, not retried.
  const stale = await db
    .update(notifications)
    .set({ status: "unknown", lockedAt: null })
    .where(
      and(
        eq(notifications.clinicId, clinic.id),
        eq(notifications.status, "sending"),
        lt(notifications.lockedAt, new Date(now.getTime() - STALE_SENDING_MS)),
      ),
    )
    .returning({ id: notifications.id });
  result.unknown = stale.length;

  if (!isInSendWindow(now, clinic.timezone)) return result;

  // Claim a batch atomically; concurrent runs skip rows another run holds.
  const claimed = await db
    .update(notifications)
    .set({ status: "sending", lockedAt: now, attempts: sql`${notifications.attempts} + 1` })
    .where(
      inArray(
        notifications.id,
        db
          .select({ id: notifications.id })
          .from(notifications)
          .where(
            and(
              eq(notifications.clinicId, clinic.id),
              eq(notifications.status, "pending"),
              lte(notifications.scheduledFor, now),
            ),
          )
          .orderBy(asc(notifications.scheduledFor))
          .limit(DISPATCH_BATCH)
          .for("update", { skipLocked: true }),
      ),
    )
    .returning();

  for (const notification of claimed) {
    const outcome = await sendOne(db, clinic, notification, deps);
    result[outcome] += 1;
  }
  return result;
}

async function sendOne(
  db: Database,
  clinic: ClinicRow,
  notification: Notification,
  deps: DispatchDeps,
): Promise<keyof DispatchResult> {
  const skip = async (reason: SkipReason) => {
    await finish(db, notification, { status: "skipped", skipReason: reason });
    return "skipped" as const;
  };

  // The locks come first: with any of them closed no provider is called.
  if (!deps.sendingEnabled) return skip("sending_disabled");
  if (!deps.provider.delivers) return skip("provider_disabled");
  if (!featureOn(clinic, notification.kind)) return skip("feature_off");

  let phone: string;
  let body: string;
  if (isTransactional(notification.kind)) {
    const target = await resolveTransactionalTarget(db, notification);
    if ("skip" in target) return skip(target.skip);
    phone = target.phone;
    const when = utcToLocal(target.startsAt, clinic.timezone);
    body =
      notification.kind === "appointment_confirmation"
        ? smsTemplates.confirmation(clinic.name, when, clinic.address)
        : notification.kind === "appointment_cancellation"
          ? smsTemplates.cancellation(clinic.name, when)
          : smsTemplates.rescheduled(clinic.name, when);
  } else if (notification.kind === "follow_up_reminder") {
    const target = await resolveFollowUpTarget(db, notification, deps.now);
    if ("skip" in target) return skip(target.skip);
    phone = target.phone;
    body = smsTemplates.followUpReminder(clinic.name);
  } else {
    const target = await resolveAppointmentTarget(db, notification);
    if ("skip" in target) return skip(target.skip);
    phone = target.phone;
    body = smsTemplates.appointmentReminder(
      clinic.name,
      utcToLocal(target.startsAt, clinic.timezone),
    );
  }
  if (await capReached(db, clinic, notification, deps.now)) return skip("cap_reached");

  try {
    await deps.provider.send(phone, body);
    await finish(db, notification, {
      status: "sent",
      sentAt: deps.now,
      provider: deps.providerName,
    });
    return "sent";
  } catch (error) {
    const errorCode = error instanceof Error ? error.message.slice(0, 120) : "send_failed";
    if (notification.attempts < MAX_ATTEMPTS) {
      await finish(db, notification, {
        status: "pending",
        errorCode,
        scheduledFor: new Date(deps.now.getTime() + RETRY_DELAY_MS),
      });
      return "retried";
    }
    await finish(db, notification, { status: "failed", errorCode });
    return "failed";
  }
}

/** The patient and appointment, looked up within the notification's own clinic. */
async function resolveAppointmentTarget(
  db: Database,
  notification: Notification,
): Promise<{ phone: string; startsAt: Date } | { skip: SkipReason }> {
  const patient = await resolvePatientPhone(db, notification);
  if ("skip" in patient) return patient;
  const { phone } = patient;

  const [appointment] = await db
    .select({ startsAt: appointments.startsAt, status: appointments.status })
    .from(appointments)
    .where(
      and(
        eq(appointments.clinicId, notification.clinicId),
        eq(appointments.id, notification.subjectId),
        eq(appointments.patientId, notification.patientId!),
      ),
    );
  const stillDue =
    appointment &&
    (ACTIVE_APPOINTMENT_STATUSES as readonly string[]).includes(appointment.status) &&
    appointmentReminderKey(notification.subjectId, appointment.startsAt) === notification.dedupeKey;
  if (!stillDue) return { skip: "subject_changed" };
  return { phone, startsAt: appointment.startsAt };
}

function isTransactional(kind: Notification["kind"]): kind is AppointmentMessageKind {
  return TRANSACTIONAL_KINDS.includes(kind);
}

/**
 * A booking or reschedule message goes only while the appointment is still
 * active; a cancellation message only while it is still cancelled.
 */
async function resolveTransactionalTarget(
  db: Database,
  notification: Notification,
): Promise<{ phone: string; startsAt: Date } | { skip: SkipReason }> {
  const patient = await resolvePatientPhone(db, notification);
  if ("skip" in patient) return patient;
  const [appointment] = await db
    .select({ startsAt: appointments.startsAt, status: appointments.status })
    .from(appointments)
    .where(
      and(
        eq(appointments.clinicId, notification.clinicId),
        eq(appointments.id, notification.subjectId),
        eq(appointments.patientId, notification.patientId!),
      ),
    );
  if (!appointment) return { skip: "subject_changed" };
  const active = (ACTIVE_APPOINTMENT_STATUSES as readonly string[]).includes(appointment.status);
  const stillTrue =
    notification.kind === "appointment_cancellation" ? appointment.status === "cancelled" : active;
  if (!stillTrue) return { skip: "subject_changed" };
  return { phone: patient.phone, startsAt: appointment.startsAt };
}

function featureOn(clinic: ClinicRow, kind: Notification["kind"]): boolean {
  if (isTransactional(kind)) return clinic.settings.notifications.smsConfirmation;
  if (kind === "follow_up_reminder") {
    return clinic.settings.features.followUp && clinic.settings.followUp.smsReminders;
  }
  return clinic.settings.notifications.smsReminderHoursBefore !== null;
}

/** Patient phone, opted out or not, within the notification's own clinic. */
async function resolvePatientPhone(
  db: Database,
  notification: Notification,
): Promise<{ phone: string } | { skip: SkipReason }> {
  if (!notification.patientId) return { skip: "patient_removed" };
  const [patient] = await db
    .select({ phone: patients.phone, smsOptOutAt: patients.smsOptOutAt })
    .from(patients)
    .where(
      and(eq(patients.clinicId, notification.clinicId), eq(patients.id, notification.patientId)),
    );
  if (!patient) return { skip: "patient_removed" };
  if (await isOptedOut(db, notification.clinicId, patient)) return { skip: "opted_out" };
  const phone = normalizePhone(patient.phone);
  if (!phone) return { skip: "invalid_phone" };
  return { phone };
}

/**
 * A follow-up reminder still applies only while the plan is active, has SMS
 * consent, its rule still sends SMS, it is not booked and its due date is
 * the one the reminder was planned for.
 */
async function resolveFollowUpTarget(
  db: Database,
  notification: Notification,
  now: Date,
): Promise<{ phone: string } | { skip: SkipReason }> {
  const [plan] = await db
    .select({
      state: followUpPlans.state,
      nextDueOn: followUpPlans.nextDueOn,
      smsConsentAt: followUpPlans.smsConsentAt,
      patientId: followUpPlans.patientId,
      ruleSms: followUpRules.smsReminders,
      booked: sql<boolean>`exists (
        select 1 from ${followUpVisits} v
        join ${appointments} a on a.clinic_id = v.clinic_id and a.id = v.appointment_id
        where v.plan_id = ${followUpPlans.id}
          and a.status in ('scheduled', 'confirmed') and a.ends_at > ${now}
      )`,
    })
    .from(followUpPlans)
    .innerJoin(
      followUpRules,
      and(
        eq(followUpRules.clinicId, followUpPlans.clinicId),
        eq(followUpRules.id, followUpPlans.ruleId),
      ),
    )
    .where(
      and(
        eq(followUpPlans.clinicId, notification.clinicId),
        eq(followUpPlans.id, notification.subjectId),
      ),
    );
  if (!plan || plan.patientId !== notification.patientId) return { skip: "subject_changed" };
  if (!plan.smsConsentAt) return { skip: "no_consent" };
  const dueInKey = notification.dedupeKey.split(":")[2];
  if (plan.state !== "active" || !plan.ruleSms || plan.booked || plan.nextDueOn !== dueInKey) {
    return { skip: "subject_changed" };
  }
  return resolvePatientPhone(db, notification);
}

/**
 * Per clinic per day across every kind; per patient per day by category, so
 * a booking confirmation does not use up the patient's reminder.
 */
async function capReached(
  db: Database,
  clinic: ClinicRow,
  notification: Notification,
  now: Date,
): Promise<boolean> {
  const { start } = localDayRange(localToday(now, clinic.timezone), clinic.timezone);
  const sentToday = and(
    eq(notifications.clinicId, clinic.id),
    eq(notifications.status, "sent"),
    gte(notifications.sentAt, start),
  );
  const [clinicTotal] = await db.select({ value: count() }).from(notifications).where(sentToday);
  if ((clinicTotal?.value ?? 0) >= DAILY_SMS_CAP_PER_CLINIC) return true;
  const transactional = isTransactional(notification.kind);
  const [patientTotal] = await db
    .select({ value: count() })
    .from(notifications)
    .where(
      and(
        sentToday,
        eq(notifications.patientId, notification.patientId!),
        transactional
          ? inArray(notifications.kind, [...TRANSACTIONAL_KINDS])
          : notInArray(notifications.kind, [...TRANSACTIONAL_KINDS]),
      ),
    );
  const limit = transactional ? DAILY_TRANSACTIONAL_PER_PATIENT : DAILY_REMINDERS_PER_PATIENT;
  return (patientTotal?.value ?? 0) >= limit;
}

async function finish(
  db: Database,
  notification: Notification,
  values: Partial<typeof notifications.$inferInsert>,
) {
  await db
    .update(notifications)
    .set({ lockedAt: null, ...values })
    .where(
      and(eq(notifications.clinicId, notification.clinicId), eq(notifications.id, notification.id)),
    );
}

export interface JobResult {
  /** skipped: today's run had already finished every clinic. */
  status: RunStatus | "skipped";
  clinics: number;
  planned: number;
  tooLate: number;
  dispatched: DispatchResult;
  failedClinics: number;
  /** Clinics left for a continuation when the time budget ran out. */
  remaining: number;
  invocations: number;
}

export interface JobOptions {
  /** Stop starting new clinics after this long; the rest go to a continuation. */
  budgetMs?: number;
  /** HOURLY_REMINDERS: appointment reminders come from the hourly job, not this one. */
  hourlyReminders?: boolean;
  /** Milliseconds, for tests. */
  clock?: () => number;
}

/**
 * The daily job: each clinic on its own (a failure in one never stops or
 * touches another), planning first, then sending. Progress is recorded per
 * clinic in today's run, so a continuation or a re-run only does what is left
 * (failed clinics are tried again).
 */
export async function runNotificationJob(
  db: Database,
  deps: DispatchDeps,
  log: (failure: { clinicId: string; error: unknown }) => void = () => {},
  options: JobOptions = {},
): Promise<JobResult> {
  const clock = options.clock ?? (() => performance.now());
  const startedAt = clock();
  const budget = options.budgetMs ?? Number.POSITIVE_INFINITY;
  const run = await beginRun(db, "notifications", deps.now);
  const result: JobResult = {
    status: "succeeded",
    clinics: 0,
    planned: 0,
    tooLate: 0,
    dispatched: { sent: 0, failed: 0, retried: 0, skipped: 0, unknown: 0 },
    failedClinics: 0,
    remaining: 0,
    invocations: run.invocations,
  };
  if (run.status === "succeeded") return { ...result, status: "skipped" };

  const done = await finishedClinicIds(db, run.id);
  const rows = await db
    .select({
      id: clinics.id,
      name: clinics.name,
      timezone: clinics.timezone,
      address: clinics.address,
      settings: clinics.settings,
    })
    .from(clinics)
    .orderBy(asc(clinics.createdAt));
  const pending = rows.filter((row) => !done.has(row.id));

  for (const [index, row] of pending.entries()) {
    if (clock() - startedAt > budget) {
      result.remaining = pending.length - index;
      break;
    }
    result.clinics += 1;
    try {
      const clinic: ClinicRow = { ...row, settings: parseClinicSettings(row.settings) };
      if (!options.hourlyReminders) {
        const plan = await planAppointmentReminders(db, clinic, deps.now);
        result.planned += plan.planned;
        result.tooLate += plan.tooLate;
      }
      if (clinic.settings.features.followUp) {
        // Passed appointments count by time alone; refresh before deciding reminders.
        await recomputeStalePlans(db, { clinicId: clinic.id, timeZone: clinic.timezone }, deps.now);
        result.planned += await planFollowUpReminders(db, clinic, deps.now);
      }
      const sent = await dispatchNotifications(db, clinic, deps);
      for (const key of Object.keys(sent) as (keyof DispatchResult)[]) {
        result.dispatched[key] += sent[key];
      }
      await recordClinic(db, run.id, row.id, { status: "done" }, deps.now);
    } catch (error) {
      result.failedClinics += 1;
      log({ clinicId: row.id, error });
      await recordClinic(
        db,
        run.id,
        row.id,
        { status: "failed", errorCode: errorCodeOf(error) },
        deps.now,
      ).catch(() => {});
    }
  }

  result.status =
    result.remaining > 0 ? "partial" : result.failedClinics > 0 ? "failed" : "succeeded";
  const { status, ...counts } = result;
  await endRun(db, run.id, status as Exclude<RunStatus, "running">, counts, deps.now);
  return result;
}

/** A short, data-free code for the run record: a domain or database code, or the error name. */
function errorCodeOf(error: unknown): string {
  if (error && typeof error === "object") {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code.slice(0, 40);
    const cause = (error as { cause?: { code?: unknown } }).cause?.code;
    if (typeof cause === "string") return cause.slice(0, 40);
  }
  return error instanceof Error ? error.name.slice(0, 40) : "error";
}

/** KVKK erasure: the log keeps no link to the person; pending messages are dropped. */
export async function detachPatientNotifications(
  exec: Executor,
  clinicId: string,
  patientId: string,
): Promise<void> {
  await exec
    .update(notifications)
    .set({ status: "skipped", skipReason: "patient_removed", lockedAt: null })
    .where(
      and(
        eq(notifications.clinicId, clinicId),
        eq(notifications.patientId, patientId),
        eq(notifications.status, "pending"),
      ),
    );
  await exec
    .update(notifications)
    .set({ patientId: null })
    .where(and(eq(notifications.clinicId, clinicId), eq(notifications.patientId, patientId)));
}
