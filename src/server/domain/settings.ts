import "server-only";

import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import type {
  AssistantSettingsInput,
  BookingRulesInput,
  PractitionerInput,
  ServiceInput,
  WeeklyHours,
} from "@/lib/contracts/settings";

import type { Database, Executor } from "../db";
import { clinics, practitioners, practitionerServices, services, workingHours } from "../db/schema";
import { parseClinicSettings, type ClinicSettingsInput } from "./clinic-settings";
import { DomainError } from "./errors";

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
      await tx
        .insert(practitionerServices)
        .values(
          [...new Set(input.serviceIds)].map((serviceId) => ({ practitionerId: id!, serviceId })),
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
