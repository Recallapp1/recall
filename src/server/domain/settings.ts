import "server-only";

import { and, asc, count, eq, gt, inArray, isNull, lt } from "drizzle-orm";

import { ACTIVE_APPOINTMENT_STATUSES } from "@/lib/contracts/appointment";
import type { ClinicLimitKey, ClinicLimits } from "@/lib/contracts/platform";

import type {
  AssistantSettingsInput,
  BookingRulesInput,
  PanelPreferencesInput,
  PractitionerInput,
  ServiceInput,
  TimeOffInput,
  WeeklyHours,
} from "@/lib/contracts/settings";

import type { Database, Executor } from "../db";
import {
  appointments,
  clinics,
  practitioners,
  practitionerServices,
  services,
  timeOff,
  workingHours,
} from "../db/schema";
import { parseClinicSettings, type ClinicSettingsInput } from "./clinic-settings";
import { DomainError } from "./errors";
import { addLocalDays, localToUtc } from "./time";

/*
 * Clinic configuration edited from the panel (F5.3). Every write is scoped by
 * clinicId and checks that referenced practitioners and services belong to
 * the same clinic.
 */

export async function updateClinicProfile(
  exec: Executor,
  clinicId: string,
  input: { name: string; address: string | null; transferPhoneNumber: string | null },
): Promise<void> {
  await exec.update(clinics).set(input).where(eq(clinics.id, clinicId));
}

async function mergeSettings(
  exec: Executor,
  clinicId: string,
  patch: (current: ReturnType<typeof parseClinicSettings>) => ClinicSettingsInput,
): Promise<void> {
  const [row] = await exec
    .select({ settings: clinics.settings })
    .from(clinics)
    .where(eq(clinics.id, clinicId));
  if (!row) throw new DomainError("CLINIC_NOT_FOUND", "Klinik bulunamadı.");
  const next = parseClinicSettings(patch(parseClinicSettings(row.settings)));
  await exec.update(clinics).set({ settings: next }).where(eq(clinics.id, clinicId));
}

/** Takip settings (panel, clinicSettings.update). */
export async function updateFollowUpSettings(
  exec: Executor,
  clinicId: string,
  input: { smsReminders: boolean; dueSoonDays: number },
): Promise<void> {
  await mergeSettings(exec, clinicId, (current) => ({ ...current, followUp: input }));
}

/**
 * Abuse and cost limits, set by the Recall team from the console only
 * (CONSOLE_LIMITS_EDIT). Returns the names of the limits that changed.
 */
export async function setClinicLimits(
  exec: Executor,
  clinicId: string,
  limits: ClinicLimits,
): Promise<ClinicLimitKey[]> {
  let changed: ClinicLimitKey[] = [];
  await mergeSettings(exec, clinicId, (current) => {
    changed = (Object.keys(limits) as ClinicLimitKey[]).filter(
      (key) => current.limits[key] !== limits[key],
    );
    return { ...current, limits };
  });
  return changed;
}

/** Modules switched by the Recall team from the console only. */
export async function setClinicFeature(
  exec: Executor,
  clinicId: string,
  feature: "followUp",
  enabled: boolean,
): Promise<void> {
  await mergeSettings(exec, clinicId, (current) => ({
    ...current,
    features: { ...current.features, [feature]: enabled },
  }));
}

export async function updateAssistantSettings(
  exec: Executor,
  clinicId: string,
  input: AssistantSettingsInput,
): Promise<void> {
  await mergeSettings(exec, clinicId, (current) => ({
    ...current,
    assistant: {
      ...current.assistant,
      name: input.name,
      greeting: input.greeting ?? undefined,
      speakPrices: input.speakPrices,
      recordCalls: input.recordCalls,
      extraInstructions: input.extraInstructions ?? undefined,
      faq: input.faq,
    },
  }));
}

export async function updateAssistantVoice(
  exec: Executor,
  clinicId: string,
  voiceId: string | null,
): Promise<void> {
  await mergeSettings(exec, clinicId, (current) => ({
    ...current,
    assistant: { ...current.assistant, voiceId: voiceId ?? undefined },
  }));
}

export async function updateBookingRules(
  exec: Executor,
  clinicId: string,
  input: BookingRulesInput,
): Promise<void> {
  await mergeSettings(exec, clinicId, (current) => ({
    ...current,
    booking: {
      slotIntervalMinutes: input.slotIntervalMinutes,
      minNoticeMinutes: input.minNoticeMinutes,
      maxDaysAhead: input.maxDaysAhead,
      cancellationMinNoticeHours: input.cancellationMinNoticeHours,
      allowPractitionerChoice: input.allowPractitionerChoice,
    },
    notifications: {
      smsConfirmation: input.smsConfirmation,
      smsReminderHoursBefore: input.smsReminderHoursBefore,
    },
  }));
}

export async function updatePanelPreferences(
  exec: Executor,
  clinicId: string,
  input: PanelPreferencesInput,
): Promise<void> {
  await mergeSettings(exec, clinicId, (current) => ({
    ...current,
    panel: {
      hiddenModules: [...new Set(input.hiddenModules)],
      defaultCalendarView: input.defaultCalendarView,
    },
  }));
}

// ─── Hours ───────────────────────────────────────────────────────────────────

export async function loadWeeklyHours(
  exec: Executor,
  clinicId: string,
  practitionerId: string | null,
): Promise<WeeklyHours> {
  const rows = await exec
    .select({
      weekday: workingHours.weekday,
      startTime: workingHours.startTime,
      endTime: workingHours.endTime,
    })
    .from(workingHours)
    .where(
      and(
        eq(workingHours.clinicId, clinicId),
        practitionerId
          ? eq(workingHours.practitionerId, practitionerId)
          : isNull(workingHours.practitionerId),
      ),
    )
    .orderBy(asc(workingHours.weekday), asc(workingHours.startTime));
  return rows.map((row) => ({
    weekday: row.weekday,
    startTime: row.startTime.slice(0, 5),
    endTime: row.endTime.slice(0, 5),
  }));
}

async function replaceHours(
  exec: Executor,
  clinicId: string,
  practitionerId: string | null,
  hours: WeeklyHours,
): Promise<void> {
  await exec
    .delete(workingHours)
    .where(
      and(
        eq(workingHours.clinicId, clinicId),
        practitionerId
          ? eq(workingHours.practitionerId, practitionerId)
          : isNull(workingHours.practitionerId),
      ),
    );
  if (hours.length > 0) {
    await exec
      .insert(workingHours)
      .values(hours.map((range) => ({ ...range, clinicId, practitionerId })));
  }
}

export async function replaceClinicHours(
  db: Database,
  clinicId: string,
  hours: WeeklyHours,
): Promise<void> {
  await db.transaction((tx) => replaceHours(tx, clinicId, null, hours));
}

// ─── Practitioners ───────────────────────────────────────────────────────────

export interface PractitionerDetail {
  id: string;
  name: string;
  title: string | null;
  isActive: boolean;
  serviceIds: string[];
  hours: WeeklyHours;
}

export async function listPractitionerDetails(
  exec: Executor,
  clinicId: string,
): Promise<PractitionerDetail[]> {
  const rows = await exec
    .select()
    .from(practitioners)
    .where(eq(practitioners.clinicId, clinicId))
    .orderBy(asc(practitioners.name));
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return [];
  const [links, hours] = await Promise.all([
    exec
      .select()
      .from(practitionerServices)
      .where(inArray(practitionerServices.practitionerId, ids)),
    exec
      .select()
      .from(workingHours)
      .where(and(eq(workingHours.clinicId, clinicId), inArray(workingHours.practitionerId, ids)))
      .orderBy(asc(workingHours.weekday), asc(workingHours.startTime)),
  ]);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    title: row.title,
    isActive: row.isActive,
    serviceIds: links.filter((l) => l.practitionerId === row.id).map((l) => l.serviceId),
    hours: hours
      .filter((h) => h.practitionerId === row.id)
      .map((h) => ({
        weekday: h.weekday,
        startTime: h.startTime.slice(0, 5),
        endTime: h.endTime.slice(0, 5),
      })),
  }));
}

async function assertServicesBelong(exec: Executor, clinicId: string, serviceIds: string[]) {
  if (serviceIds.length === 0) return;
  const found = await exec
    .select({ id: services.id })
    .from(services)
    .where(and(eq(services.clinicId, clinicId), inArray(services.id, serviceIds)));
  if (found.length !== new Set(serviceIds).size) {
    throw new DomainError("INVALID_SERVICE", "Seçilen hizmetlerden biri bu kliniğe ait değil.");
  }
}

/** Creates or updates a practitioner with their services and weekly hours. */
export async function savePractitioner(
  db: Database,
  clinicId: string,
  input: PractitionerInput,
): Promise<string> {
  return db.transaction(async (tx) => {
    await assertServicesBelong(tx, clinicId, input.serviceIds);
    let id = input.id;
    if (id) {
      const updated = await tx
        .update(practitioners)
        .set({ name: input.name, title: input.title, isActive: input.isActive })
        .where(and(eq(practitioners.clinicId, clinicId), eq(practitioners.id, id)))
        .returning({ id: practitioners.id });
      if (updated.length === 0) {
        throw new DomainError("INVALID_PRACTITIONER", "Hekim bulunamadı.");
      }
    } else {
      const [created] = await tx
        .insert(practitioners)
        .values({ clinicId, name: input.name, title: input.title, isActive: input.isActive })
        .returning({ id: practitioners.id });
      id = created!.id;
    }

    await tx.delete(practitionerServices).where(eq(practitionerServices.practitionerId, id));
    if (input.serviceIds.length > 0) {
      await tx.insert(practitionerServices).values(
        [...new Set(input.serviceIds)].map((serviceId) => ({
          clinicId,
          practitionerId: id!,
          serviceId,
        })),
      );
    }
    await replaceHours(tx, clinicId, id, input.hours);
    return id;
  });
}

// ─── Services ────────────────────────────────────────────────────────────────

export async function listServiceDetails(exec: Executor, clinicId: string) {
  return exec
    .select()
    .from(services)
    .where(eq(services.clinicId, clinicId))
    .orderBy(asc(services.name));
}

export async function saveService(
  exec: Executor,
  clinicId: string,
  input: ServiceInput,
): Promise<string> {
  const values = {
    name: input.name,
    description: input.description,
    aliases: input.aliases,
    durationMinutes: input.durationMinutes,
    priceMin: input.priceMin,
    priceMax: input.priceMax,
    isActive: input.isActive,
  };
  if (input.id) {
    const updated = await exec
      .update(services)
      .set(values)
      .where(and(eq(services.clinicId, clinicId), eq(services.id, input.id)))
      .returning({ id: services.id });
    if (updated.length === 0) throw new DomainError("INVALID_SERVICE", "Hizmet bulunamadı.");
    return input.id;
  }
  const [created] = await exec
    .insert(services)
    .values({ clinicId, ...values })
    .returning({ id: services.id });
  return created!.id;
}

// ─── Time off (holidays, closures, leave) ────────────────────────────────────

export interface TimeOffEntry {
  id: string;
  practitionerId: string | null;
  startsAt: Date;
  endsAt: Date;
  reason: string | null;
}

export async function listTimeOff(
  exec: Executor,
  clinicId: string,
  from: Date,
): Promise<TimeOffEntry[]> {
  return exec
    .select({
      id: timeOff.id,
      practitionerId: timeOff.practitionerId,
      startsAt: timeOff.startsAt,
      endsAt: timeOff.endsAt,
      reason: timeOff.reason,
    })
    .from(timeOff)
    .where(and(eq(timeOff.clinicId, clinicId), gt(timeOff.endsAt, from)))
    .orderBy(asc(timeOff.startsAt));
}

/** UTC range of a time-off entry in the clinic's zone (whole days are end-exclusive). */
export function timeOffRange(
  input: TimeOffInput,
  timeZone: string,
): { startsAt: Date; endsAt: Date } {
  const minutes = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    return h! * 60 + m!;
  };
  if (input.startTime && input.endTime) {
    return {
      startsAt: localToUtc(input.startDate, minutes(input.startTime), timeZone),
      endsAt: localToUtc(input.startDate, minutes(input.endTime), timeZone),
    };
  }
  return {
    startsAt: localToUtc(input.startDate, 0, timeZone),
    endsAt: localToUtc(addLocalDays(input.endDate, 1), 0, timeZone),
  };
}

/**
 * Adds a closure or leave. Returns how many active appointments fall inside
 * it: they are not cancelled automatically, the team decides and informs
 * the patients.
 */
export async function addTimeOff(
  exec: Executor,
  clinic: { id: string; timezone: string },
  input: TimeOffInput,
): Promise<{ id: string; conflictingAppointments: number }> {
  if (input.practitionerId) {
    const [practitioner] = await exec
      .select({ id: practitioners.id })
      .from(practitioners)
      .where(
        and(eq(practitioners.clinicId, clinic.id), eq(practitioners.id, input.practitionerId)),
      );
    if (!practitioner) throw new DomainError("INVALID_PRACTITIONER", "Hekim bulunamadı.");
  }
  const { startsAt, endsAt } = timeOffRange(input, clinic.timezone);
  const [created] = await exec
    .insert(timeOff)
    .values({
      clinicId: clinic.id,
      practitionerId: input.practitionerId,
      startsAt,
      endsAt,
      reason: input.reason,
    })
    .returning({ id: timeOff.id });

  const [conflicts] = await exec
    .select({ value: count() })
    .from(appointments)
    .where(
      and(
        eq(appointments.clinicId, clinic.id),
        inArray(appointments.status, [...ACTIVE_APPOINTMENT_STATUSES]),
        lt(appointments.startsAt, endsAt),
        gt(appointments.endsAt, startsAt),
        ...(input.practitionerId ? [eq(appointments.practitionerId, input.practitionerId)] : []),
      ),
    );
  return { id: created!.id, conflictingAppointments: conflicts?.value ?? 0 };
}

export async function deleteTimeOff(exec: Executor, clinicId: string, id: string): Promise<void> {
  const deleted = await exec
    .delete(timeOff)
    .where(and(eq(timeOff.clinicId, clinicId), eq(timeOff.id, id)))
    .returning({ id: timeOff.id });
  if (deleted.length === 0) throw new DomainError("NOT_FOUND", "Kayıt bulunamadı.");
}

/** Adds the year's public holidays as clinic closures, skipping ones already present. */
export async function addPublicHolidays(
  db: Database,
  clinic: { id: string; timezone: string },
  holidays: readonly { name: string; startDate: string; endDate: string; fromTime?: string }[],
): Promise<number> {
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ startsAt: timeOff.startsAt })
      .from(timeOff)
      .where(and(eq(timeOff.clinicId, clinic.id), isNull(timeOff.practitionerId)));
    const taken = new Set(existing.map((row) => row.startsAt.getTime()));
    const rows: (typeof timeOff.$inferInsert)[] = [];
    for (const holiday of holidays) {
      const range = holiday.fromTime
        ? timeOffRange(
            {
              practitionerId: null,
              startDate: holiday.startDate,
              endDate: holiday.startDate,
              startTime: holiday.fromTime,
              endTime: "23:59",
              reason: holiday.name,
            },
            clinic.timezone,
          )
        : timeOffRange(
            {
              practitionerId: null,
              startDate: holiday.startDate,
              endDate: holiday.endDate,
              startTime: null,
              endTime: null,
              reason: holiday.name,
            },
            clinic.timezone,
          );
      if (taken.has(range.startsAt.getTime())) continue;
      rows.push({ clinicId: clinic.id, practitionerId: null, ...range, reason: holiday.name });
    }
    // One round trip: holidays are added in bulk.
    if (rows.length > 0) await tx.insert(timeOff).values(rows);
    return rows.length;
  });
}
