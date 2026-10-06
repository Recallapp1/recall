import "server-only";

import { and, asc, count, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";

import { ACTIVE_APPOINTMENT_STATUSES } from "@/lib/contracts/appointment";
import type { SkipReason } from "@/lib/contracts/notification";
import { normalizePhone } from "@/lib/phone";

import type { Database, Executor } from "../db";
import { appointments, clinics, notifications, patients, type Notification } from "../db/schema";
import type { SmsProvider } from "../notifications/sms";
import { SMS_TEMPLATE_KEYS, smsTemplates } from "../notifications/sms";
import { parseClinicSettings, type ClinicSettings } from "./clinic-settings";
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
const DISPATCH_BATCH = 200;

interface ClinicRow {
  id: string;
  name: string;
  timezone: string;
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
  if (clinic.settings.notifications.smsReminderHoursBefore === null) return skip("feature_off");

  const target = await resolveAppointmentTarget(db, notification);
  if ("skip" in target) return skip(target.skip);
  if (await capReached(db, clinic, notification, deps.now)) return skip("cap_reached");

  try {
    await deps.provider.send(
      target.phone,
      smsTemplates.appointmentReminder(clinic.name, utcToLocal(target.startsAt, clinic.timezone)),
    );
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
  if (!notification.patientId) return { skip: "patient_removed" };
  const [patient] = await db
    .select({ phone: patients.phone, smsOptOutAt: patients.smsOptOutAt })
    .from(patients)
    .where(
      and(eq(patients.clinicId, notification.clinicId), eq(patients.id, notification.patientId)),
    );
  if (!patient) return { skip: "patient_removed" };
  if (patient.smsOptOutAt) return { skip: "opted_out" };
  const phone = normalizePhone(patient.phone);
  if (!phone) return { skip: "invalid_phone" };

  const [appointment] = await db
    .select({ startsAt: appointments.startsAt, status: appointments.status })
    .from(appointments)
    .where(
      and(
        eq(appointments.clinicId, notification.clinicId),
        eq(appointments.id, notification.subjectId),
        eq(appointments.patientId, notification.patientId),
      ),
    );
  const stillDue =
    appointment &&
    (ACTIVE_APPOINTMENT_STATUSES as readonly string[]).includes(appointment.status) &&
    appointmentReminderKey(notification.subjectId, appointment.startsAt) === notification.dedupeKey;
  if (!stillDue) return { skip: "subject_changed" };
  return { phone, startsAt: appointment.startsAt };
}

/** Per clinic per day, and one message per patient per day. */
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
  const [patientTotal] = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(sentToday, eq(notifications.patientId, notification.patientId!)));
  return (patientTotal?.value ?? 0) >= 1;
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
  clinics: number;
  planned: number;
  tooLate: number;
  dispatched: DispatchResult;
  failedClinics: number;
}

/**
 * The daily job: each clinic on its own (a failure in one never stops or
 * touches another), planning first, then sending.
 */
export async function runNotificationJob(
  db: Database,
  deps: DispatchDeps,
  log: (failure: { clinicId: string; error: unknown }) => void = () => {},
): Promise<JobResult> {
  const result: JobResult = {
    clinics: 0,
    planned: 0,
    tooLate: 0,
    dispatched: { sent: 0, failed: 0, retried: 0, skipped: 0, unknown: 0 },
    failedClinics: 0,
  };
  const rows = await db
    .select({
      id: clinics.id,
      name: clinics.name,
      timezone: clinics.timezone,
      settings: clinics.settings,
    })
    .from(clinics)
    .orderBy(asc(clinics.createdAt));

  for (const row of rows) {
    const clinic: ClinicRow = { ...row, settings: parseClinicSettings(row.settings) };
    result.clinics += 1;
    try {
      const plan = await planAppointmentReminders(db, clinic, deps.now);
      result.planned += plan.planned;
      result.tooLate += plan.tooLate;
      const sent = await dispatchNotifications(db, clinic, deps);
      for (const key of Object.keys(sent) as (keyof DispatchResult)[]) {
        result.dispatched[key] += sent[key];
      }
    } catch (error) {
      result.failedClinics += 1;
      log({ clinicId: clinic.id, error });
    }
  }
  return result;
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
