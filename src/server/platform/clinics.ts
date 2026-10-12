import "server-only";

import { and, asc, count, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";

import {
  CLINIC_TEMPLATES,
  DEFAULT_CLINIC_HOURS,
  type ClinicTemplate,
} from "@/lib/clinic-templates";
import type { CreateClinicInput } from "@/lib/contracts/platform";

import type { Database, Executor } from "../db";
import {
  calls,
  clinics,
  members,
  organizations,
  phoneNumbers,
  practitioners,
  services,
  timeOff,
  users,
  voiceAgents,
  workingHours,
} from "../db/schema";
import { DomainError } from "../domain/errors";

/*
 * Recall console (F6). Platform admins see clinic metadata, team accounts and
 * call metrics, never patient data (names, numbers, transcripts): that stays
 * behind a clinic membership (F7).
 */

/** Creates the clinic, its organization, template services and default hours in one go. */
export async function createClinic(
  db: Database,
  input: Omit<CreateClinicInput, "ownerName" | "ownerEmail">,
): Promise<{ clinicId: string }> {
  const template = CLINIC_TEMPLATES[input.template as ClinicTemplate];
  return db.transaction(async (tx) => {
    const [taken] = await tx
      .select({ id: clinics.id })
      .from(clinics)
      .where(eq(clinics.slug, input.slug));
    if (taken)
      throw new DomainError("SLUG_TAKEN", "Bu kısa ad kullanılıyor. Başka bir kısa ad seçin.");

    const [organization] = await tx
      .insert(organizations)
      .values({ name: input.name, slug: input.slug })
      .returning({ id: organizations.id });
    const [clinic] = await tx
      .insert(clinics)
      .values({
        name: input.name,
        slug: input.slug,
        organizationId: organization!.id,
        timezone: "Europe/Istanbul",
      })
      .returning({ id: clinics.id });
    const clinicId = clinic!.id;

    await tx.insert(services).values(
      template.services.map((service) => ({
        clinicId,
        name: service.name,
        durationMinutes: service.durationMinutes,
        aliases: [...service.aliases],
      })),
    );
    await tx
      .insert(workingHours)
      .values(DEFAULT_CLINIC_HOURS.map((hours) => ({ ...hours, clinicId, practitionerId: null })));
    if (input.phoneNumber) {
      await addPhoneNumber(tx, { clinicId, e164: input.phoneNumber });
    }
    return { clinicId };
  });
}

export async function addPhoneNumber(
  exec: Executor,
  input: { clinicId: string; e164: string },
): Promise<void> {
  const [existing] = await exec
    .select({ clinicId: phoneNumbers.clinicId })
    .from(phoneNumbers)
    .where(eq(phoneNumbers.e164, input.e164));
  if (existing) {
    throw new DomainError(
      "PHONE_TAKEN",
      existing.clinicId === input.clinicId
        ? "Bu numara zaten bu kliniğe bağlı."
        : "Bu numara başka bir kliniğe bağlı.",
    );
  }
  await exec
    .insert(phoneNumbers)
    .values({ clinicId: input.clinicId, e164: input.e164, provider: "retell" });
}

export async function removePhoneNumber(
  exec: Executor,
  input: { clinicId: string; phoneNumberId: string },
): Promise<void> {
  const deleted = await exec
    .delete(phoneNumbers)
    .where(and(eq(phoneNumbers.clinicId, input.clinicId), eq(phoneNumbers.id, input.phoneNumberId)))
    .returning({ id: phoneNumbers.id });
  if (deleted.length === 0) throw new DomainError("NOT_FOUND", "Numara bulunamadı.");
}

export async function setClinicStatus(
  exec: Executor,
  clinicId: string,
  status: "active" | "paused",
): Promise<void> {
  const updated = await exec
    .update(clinics)
    .set({ status })
    .where(eq(clinics.id, clinicId))
    .returning({ id: clinics.id });
  if (updated.length === 0) throw new DomainError("CLINIC_NOT_FOUND", "Klinik bulunamadı.");
}

export interface CallStats {
  calls: number;
  minutes: number;
  costUsd: number;
  lastCallAt: Date | null;
}

async function callStats(exec: Executor, clinicIds: string[], since: Date) {
  if (clinicIds.length === 0) return new Map<string, CallStats>();
  const rows = await exec
    .select({
      clinicId: calls.clinicId,
      calls: count(),
      seconds: sql<number>`coalesce(sum(${calls.durationSeconds}), 0)::int`,
      cost: sql<string>`coalesce(sum(${calls.costUsd}), 0)`,
      lastCallAt: sql<string | null>`max(${calls.createdAt})`,
    })
    .from(calls)
    .where(and(inArray(calls.clinicId, clinicIds), gte(calls.createdAt, since)))
    .groupBy(calls.clinicId);
  return new Map(
    rows.map((row) => [
      row.clinicId,
      {
        calls: row.calls,
        minutes: Math.round((row.seconds / 60) * 10) / 10,
        costUsd: Number(row.cost),
        lastCallAt: row.lastCallAt ? new Date(row.lastCallAt) : null,
      },
    ]),
  );
}

const EMPTY_STATS: CallStats = { calls: 0, minutes: 0, costUsd: 0, lastCallAt: null };

/** Console home: every clinic with its health signals and last 30 days of calls. */
export async function listClinicsOverview(exec: Executor, now: Date) {
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const rows = await exec
    .select({
      id: clinics.id,
      name: clinics.name,
      slug: clinics.slug,
      status: clinics.status,
      createdAt: clinics.createdAt,
      agentStatus: voiceAgents.status,
      agentSyncedAt: voiceAgents.syncedAt,
      members: sql<number>`(select count(*)::int from ${members} where ${members.organizationId} = ${clinics.organizationId})`,
      numbers: sql<number>`(select count(*)::int from ${phoneNumbers} where ${phoneNumbers.clinicId} = ${clinics.id})`,
    })
    .from(clinics)
    .leftJoin(voiceAgents, eq(voiceAgents.clinicId, clinics.id))
    .orderBy(asc(clinics.name));
  const stats = await callStats(
    exec,
    rows.map((row) => row.id),
    since,
  );
  return rows.map((row) => ({ ...row, stats: stats.get(row.id) ?? EMPTY_STATS }));
}

export interface ChecklistItem {
  label: string;
  done: boolean;
}

/** Clinic detail for the console, including the go-live checklist (ONBOARDING.md). */
export async function getClinicOverview(exec: Executor, clinicId: string, now: Date) {
  const [clinic] = await exec.select().from(clinics).where(eq(clinics.id, clinicId));
  if (!clinic) return null;
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const in30Days = new Date(now.getTime() + 30 * 86_400_000);

  const [
    agent,
    numbers,
    team,
    practitionerCount,
    serviceCount,
    hourCount,
    closureCount,
    outcomes,
    stats,
  ] = await Promise.all([
    exec
      .select()
      .from(voiceAgents)
      .where(eq(voiceAgents.clinicId, clinicId))
      .then((r) => r[0] ?? null),
    exec
      .select()
      .from(phoneNumbers)
      .where(eq(phoneNumbers.clinicId, clinicId))
      .orderBy(asc(phoneNumbers.createdAt)),
    clinic.organizationId
      ? exec
          .select({
            memberId: members.id,
            userId: users.id,
            name: users.name,
            email: users.email,
            role: members.role,
            emailVerified: users.emailVerified,
            twoFactorEnabled: users.twoFactorEnabled,
          })
          .from(members)
          .innerJoin(users, eq(users.id, members.userId))
          .where(eq(members.organizationId, clinic.organizationId))
          .orderBy(asc(users.name))
      : Promise.resolve([]),
    exec
      .select({ value: count() })
      .from(practitioners)
      .where(and(eq(practitioners.clinicId, clinicId), eq(practitioners.isActive, true))),
    exec
      .select({ value: count() })
      .from(services)
      .where(and(eq(services.clinicId, clinicId), eq(services.isActive, true))),
    exec
      .select({ value: count() })
      .from(workingHours)
      .where(and(eq(workingHours.clinicId, clinicId), isNull(workingHours.practitionerId))),
    exec
      .select({ value: count() })
      .from(timeOff)
      .where(
        and(
          eq(timeOff.clinicId, clinicId),
          isNull(timeOff.practitionerId),
          gte(timeOff.endsAt, now),
          sql`${timeOff.startsAt} < ${in30Days}`,
        ),
      ),
    exec
      .select({ outcome: calls.outcome, value: count() })
      .from(calls)
      .where(and(eq(calls.clinicId, clinicId), gte(calls.createdAt, since)))
      .groupBy(calls.outcome)
      .orderBy(desc(count())),
    callStats(exec, [clinicId], since),
  ]);

  const checklist: ChecklistItem[] = [
    { label: "En az bir aktif hekim", done: (practitionerCount[0]?.value ?? 0) > 0 },
    { label: "En az bir aktif hizmet", done: (serviceCount[0]?.value ?? 0) > 0 },
    { label: "Haftalık çalışma saatleri", done: (hourCount[0]?.value ?? 0) > 0 },
    {
      label: "Önümüzdeki 30 günün tatilleri gözden geçirildi",
      done: (closureCount[0]?.value ?? 0) > 0,
    },
    {
      label: "Klinik sahibi hesabı parolasını belirledi",
      done: team.some((m) => m.role.includes("owner") && m.emailVerified),
    },
    { label: "Telefon numarası bağlı", done: numbers.length > 0 },
    { label: "Sesli asistan senkronize", done: agent?.status === "synced" },
    { label: "Devir numarası tanımlı", done: Boolean(clinic.transferPhoneNumber) },
  ];

  return {
    clinic,
    agent,
    numbers,
    team,
    checklist,
    outcomes,
    stats: stats.get(clinicId) ?? EMPTY_STATS,
  };
}
