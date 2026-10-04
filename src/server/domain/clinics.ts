import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";

import type { Executor } from "../db";
import { clinics, practitioners, services, workingHours, type Clinic } from "../db/schema";
import { parseClinicSettings, type ClinicSettings } from "./clinic-settings";

export interface ClinicContext {
  clinic: Clinic;
  settings: ClinicSettings;
}

export async function findClinicByPhoneNumber(
  exec: Executor,
  phoneNumber: string,
): Promise<ClinicContext | null> {
  const [clinic] = await exec.select().from(clinics).where(eq(clinics.phoneNumber, phoneNumber));
  return clinic ? { clinic, settings: parseClinicSettings(clinic.settings) } : null;
}

/** Everything the assistant needs to know about a clinic at the start of a call. */
export async function loadClinicDirectory(exec: Executor, clinicId: string) {
  const [practitionerRows, serviceRows, hourRows] = await Promise.all([
    exec
      .select({ id: practitioners.id, name: practitioners.name, title: practitioners.title })
      .from(practitioners)
      .where(and(eq(practitioners.clinicId, clinicId), eq(practitioners.isActive, true)))
      .orderBy(asc(practitioners.name)),
    exec
      .select({
        id: services.id,
        name: services.name,
        aliases: services.aliases,
        durationMinutes: services.durationMinutes,
        priceMin: services.priceMin,
        priceMax: services.priceMax,
      })
      .from(services)
      .where(and(eq(services.clinicId, clinicId), eq(services.isActive, true)))
      .orderBy(asc(services.name)),
    exec
      .select({
        weekday: workingHours.weekday,
        startTime: workingHours.startTime,
        endTime: workingHours.endTime,
      })
      .from(workingHours)
      .where(and(eq(workingHours.clinicId, clinicId), isNull(workingHours.practitionerId)))
      .orderBy(asc(workingHours.weekday), asc(workingHours.startTime)),
  ]);

  return { practitioners: practitionerRows, services: serviceRows, clinicHours: hourRows };
}

export type ClinicDirectory = Awaited<ReturnType<typeof loadClinicDirectory>>;

export function practitionerDisplayName(p: { name: string; title: string | null }): string {
  return p.title ? `${p.title} ${p.name}` : p.name;
}
