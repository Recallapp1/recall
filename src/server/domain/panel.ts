import "server-only";

import { and, asc, count, desc, eq, gte, ilike, inArray, lt, or, sql } from "drizzle-orm";

import {
  ACTIVE_APPOINTMENT_STATUSES,
  canTransition,
  type AppointmentSource,
  type AppointmentStatus,
} from "@/lib/contracts/appointment";

import type { Executor } from "../db";
import {
  appointments,
  callbackRequests,
  calls,
  patients,
  practitioners,
  services,
} from "../db/schema";
import { practitionerDisplayName, type ClinicContext } from "./clinics";
import { DomainError } from "./errors";
import { addLocalDays, localToUtc, localToday, utcToLocal, type LocalDate } from "./time";

/*
 * Read models and staff actions for the clinic panel. Every query is scoped
 * by clinicId; `practitionerScope` narrows a practitioner to their own
 * calendar (members.practitioner_id).
 */

export interface PanelScope {
  clinicId: string;
  timeZone: string;
  /** Set for members who may only see one practitioner's appointments. */
  practitionerId?: string | null;
}

export function scopeFor(ctx: ClinicContext, practitionerId?: string | null): PanelScope {
  return { clinicId: ctx.clinic.id, timeZone: ctx.clinic.timezone, practitionerId };
}

export interface PanelAppointment {
  id: string;
  startsAt: Date;
  endsAt: Date;
  /** Clinic-local "YYYY-MM-DD" and minutes since midnight, for the grid. */
  date: LocalDate;
  startMinute: number;
  endMinute: number;
  status: AppointmentStatus;
  source: AppointmentSource;
  notes: string | null;
  patientId: string;
  patientName: string;
  patientPhone: string;
  practitionerId: string;
  practitionerName: string;
  serviceId: string;
  serviceName: string;
  callId: string | null;
  createdAt: Date;
}

/** UTC bounds of clinic-local days [from, to). */
function dayRange(scope: PanelScope, from: LocalDate, toExclusive: LocalDate) {
  return {
    start: localToUtc(from, 0, scope.timeZone),
    end: localToUtc(toExclusive, 0, scope.timeZone),
  };
}

function appointmentQuery(exec: Executor) {
  return exec
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
      source: appointments.source,
      notes: appointments.notes,
      callId: appointments.callId,
      createdAt: appointments.createdAt,
      patientId: patients.id,
      patientName: patients.fullName,
      patientPhone: patients.phone,
      practitionerId: practitioners.id,
      practitionerName: practitioners.name,
      practitionerTitle: practitioners.title,
      serviceId: services.id,
      serviceName: services.name,
    })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(practitioners, eq(practitioners.id, appointments.practitionerId))
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .$dynamic();
}

type AppointmentRow = Awaited<ReturnType<ReturnType<typeof appointmentQuery>["execute"]>>[number];

function minuteOfDay(instant: Date, timeZone: string): number {
  const { time } = utcToLocal(instant, timeZone);
  const [h, m] = time.split(":").map(Number);
  return h! * 60 + m!;
}

function toPanelAppointment(row: AppointmentRow, timeZone: string): PanelAppointment {
  const startMinute = minuteOfDay(row.startsAt, timeZone);
  const date = utcToLocal(row.startsAt, timeZone).date;
  // An appointment never spans midnight in practice; clamp just in case.
  const endDate = utcToLocal(row.endsAt, timeZone).date;
  const endMinute = endDate === date ? minuteOfDay(row.endsAt, timeZone) : 24 * 60;
  return {
    id: row.id,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    date,
    startMinute,
    endMinute,
    status: row.status,
    source: row.source,
    notes: row.notes,
    patientId: row.patientId,
    patientName: row.patientName,
    patientPhone: row.patientPhone,
    practitionerId: row.practitionerId,
    practitionerName: practitionerDisplayName({
      name: row.practitionerName,
      title: row.practitionerTitle,
    }),
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    callId: row.callId,
    createdAt: row.createdAt,
  };
}

function scopeConditions(scope: PanelScope) {
  return [
    eq(appointments.clinicId, scope.clinicId),
    ...(scope.practitionerId ? [eq(appointments.practitionerId, scope.practitionerId)] : []),
  ];
}

export interface AppointmentFilter {
  from: LocalDate;
  /** Exclusive. */
  to: LocalDate;
  statuses?: AppointmentStatus[];
  practitionerId?: string;
  source?: AppointmentSource;
  /** Patient name or phone fragment. */
  search?: string;
}

export async function listAppointments(
  exec: Executor,
  scope: PanelScope,
  filter: AppointmentFilter,
  options: { limit?: number; offset?: number; order?: "asc" | "desc" } = {},
): Promise<{ rows: PanelAppointment[]; total: number }> {
  const { start, end } = dayRange(scope, filter.from, filter.to);
  const search = filter.search?.trim();
  const digits = search?.replace(/\D/g, "");
  const conditions = [
    ...scopeConditions(scope),
    gte(appointments.startsAt, start),
    lt(appointments.startsAt, end),
    ...(filter.statuses?.length ? [inArray(appointments.status, filter.statuses)] : []),
    ...(filter.practitionerId ? [eq(appointments.practitionerId, filter.practitionerId)] : []),
    ...(filter.source ? [eq(appointments.source, filter.source)] : []),
    ...(search
      ? [
          or(
            ilike(patients.fullName, `%${search}%`),
            ...(digits && digits.length >= 3 ? [ilike(patients.phone, `%${digits}%`)] : []),
          )!,
        ]
      : []),
  ];

  const [rows, [total]] = await Promise.all([
    appointmentQuery(exec)
      .where(and(...conditions))
      .orderBy(options.order === "desc" ? desc(appointments.startsAt) : asc(appointments.startsAt))
      .limit(options.limit ?? 500)
      .offset(options.offset ?? 0),
    exec
      .select({ value: count() })
      .from(appointments)
      .innerJoin(patients, eq(patients.id, appointments.patientId))
      .where(and(...conditions)),
  ]);
  return {
    rows: rows.map((row) => toPanelAppointment(row, scope.timeZone)),
    total: total?.value ?? 0,
  };
}

export async function getAppointment(
  exec: Executor,
  scope: PanelScope,
  appointmentId: string,
): Promise<PanelAppointment | null> {
  const [row] = await appointmentQuery(exec).where(
    and(...scopeConditions(scope), eq(appointments.id, appointmentId)),
  );
  return row ? toPanelAppointment(row, scope.timeZone) : null;
}

export interface TodayOverview {
  date: LocalDate;
  appointments: PanelAppointment[];
  stats: {
    appointmentsToday: number;
    bookedByAssistantToday: number;
    callsToday: number;
    openCallbacks: number;
  };
}

/** The "Bugün" screen: today's calendar and the numbers above it. */
export async function todayOverview(
  exec: Executor,
  scope: PanelScope,
  now: Date,
): Promise<TodayOverview> {
  const date = localToday(now, scope.timeZone);
  const { start, end } = dayRange(scope, date, addLocalDays(date, 1));

  const [list, [booked], [callCount], [callbacks]] = await Promise.all([
    listAppointments(exec, scope, { from: date, to: addLocalDays(date, 1) }),
    exec
      .select({ value: count() })
      .from(appointments)
      .where(
        and(
          ...scopeConditions(scope),
          eq(appointments.source, "voice"),
          gte(appointments.createdAt, start),
          lt(appointments.createdAt, end),
        ),
      ),
    exec
      .select({ value: count() })
      .from(calls)
      .where(
        and(
          eq(calls.clinicId, scope.clinicId),
          gte(calls.createdAt, start),
          lt(calls.createdAt, end),
        ),
      ),
    exec
      .select({ value: count() })
      .from(callbackRequests)
      .where(
        and(eq(callbackRequests.clinicId, scope.clinicId), eq(callbackRequests.status, "open")),
      ),
  ]);

  return {
    date,
    appointments: list.rows,
    stats: {
      appointmentsToday: list.rows.filter(
        (a) =>
          (ACTIVE_APPOINTMENT_STATUSES as readonly string[]).includes(a.status) ||
          a.status === "completed",
      ).length,
      bookedByAssistantToday: booked?.value ?? 0,
      callsToday: callCount?.value ?? 0,
      openCallbacks: callbacks?.value ?? 0,
    },
  };
}

/** Staff status change with the allowed transitions (STATUS_TRANSITIONS). */
export async function changeAppointmentStatus(
  exec: Executor,
  scope: PanelScope,
  input: { appointmentId: string; status: AppointmentStatus; now: Date },
): Promise<{ previous: AppointmentStatus }> {
  const [current] = await exec
    .select({ status: appointments.status })
    .from(appointments)
    .where(and(...scopeConditions(scope), eq(appointments.id, input.appointmentId)));
  if (!current) throw new DomainError("NOT_FOUND", "Randevu bulunamadı.");
  if (!canTransition(current.status, input.status)) {
    throw new DomainError("INVALID_TRANSITION", "Bu randevunun durumu bu şekilde değiştirilemez.");
  }

  await exec
    .update(appointments)
    .set({
      status: input.status,
      cancelledAt: input.status === "cancelled" ? input.now : null,
    })
    .where(
      and(eq(appointments.clinicId, scope.clinicId), eq(appointments.id, input.appointmentId)),
    );
  return { previous: current.status };
}

export async function updateAppointmentNotes(
  exec: Executor,
  scope: PanelScope,
  input: { appointmentId: string; notes: string | null },
): Promise<void> {
  const updated = await exec
    .update(appointments)
    .set({ notes: input.notes?.trim() || null, updatedAt: sql`now()` })
    .where(and(...scopeConditions(scope), eq(appointments.id, input.appointmentId)))
    .returning({ id: appointments.id });
  if (updated.length === 0) throw new DomainError("NOT_FOUND", "Randevu bulunamadı.");
}

/** Latest appointments the assistant booked, newest first (the "Bugün" feed). */
export async function recentAssistantBookings(
  exec: Executor,
  scope: PanelScope,
  limit = 5,
): Promise<PanelAppointment[]> {
  const rows = await appointmentQuery(exec)
    .where(and(...scopeConditions(scope), eq(appointments.source, "voice")))
    .orderBy(desc(appointments.createdAt))
    .limit(limit);
  return rows.map((row) => toPanelAppointment(row, scope.timeZone));
}

export interface PanelCallback {
  id: string;
  patientName: string | null;
  phone: string | null;
  reason: string;
  status: "open" | "done";
  callId: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

export async function listCallbacks(
  exec: Executor,
  clinicId: string,
  status: "open" | "done",
  limit = 100,
): Promise<PanelCallback[]> {
  return exec
    .select({
      id: callbackRequests.id,
      patientName: callbackRequests.patientName,
      phone: callbackRequests.phone,
      reason: callbackRequests.reason,
      status: callbackRequests.status,
      callId: callbackRequests.callId,
      createdAt: callbackRequests.createdAt,
      resolvedAt: callbackRequests.resolvedAt,
    })
    .from(callbackRequests)
    .where(and(eq(callbackRequests.clinicId, clinicId), eq(callbackRequests.status, status)))
    .orderBy(
      status === "open" ? asc(callbackRequests.createdAt) : desc(callbackRequests.resolvedAt),
    )
    .limit(limit);
}

export async function setCallbackStatus(
  exec: Executor,
  clinicId: string,
  input: { callbackId: string; status: "open" | "done"; now: Date },
): Promise<void> {
  const updated = await exec
    .update(callbackRequests)
    .set({ status: input.status, resolvedAt: input.status === "done" ? input.now : null })
    .where(and(eq(callbackRequests.clinicId, clinicId), eq(callbackRequests.id, input.callbackId)))
    .returning({ id: callbackRequests.id });
  if (updated.length === 0) throw new DomainError("NOT_FOUND", "Geri arama talebi bulunamadı.");
}

/**
 * Visible hours for the schedule grid: the clinic's opening hours on the given
 * weekdays, widened to whole hours and to any appointment outside them.
 */
export function scheduleRange(
  hours: readonly { weekday: number; startTime: string; endTime: string }[],
  weekdays: readonly number[],
  appointmentsInView: readonly { startMinute: number; endMinute: number }[],
): { startMinute: number; endMinute: number } {
  const toMinutes = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    return h! * 60 + m!;
  };
  const relevant = hours.filter((row) => weekdays.includes(row.weekday));
  const starts = [
    ...relevant.map((row) => toMinutes(row.startTime)),
    ...appointmentsInView.map((a) => a.startMinute),
  ];
  const ends = [
    ...relevant.map((row) => toMinutes(row.endTime)),
    ...appointmentsInView.map((a) => a.endMinute),
  ];
  if (starts.length === 0) return { startMinute: 9 * 60, endMinute: 18 * 60 };
  return {
    startMinute: Math.floor(Math.min(...starts) / 60) * 60,
    endMinute: Math.min(24 * 60, Math.ceil(Math.max(...ends) / 60) * 60),
  };
}
