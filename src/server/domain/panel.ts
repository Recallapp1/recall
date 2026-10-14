import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  not,
  notInArray,
  notLike,
  or,
  sql,
  type SQLWrapper,
} from "drizzle-orm";

import {
  ACTIVE_APPOINTMENT_STATUSES,
  canTransition,
  type AppointmentSource,
  type AppointmentStatus,
} from "@/lib/contracts/appointment";

import { CALL_REPORT_REASONS, type CallFlag, type CallReportReason } from "@/lib/contracts/call";
import { personName } from "@/lib/names";
import { normalizePhone } from "@/lib/phone";
import type { AppointmentSortKey, PatientSortKey, Sort } from "@/lib/contracts/sorting";

import type { Executor } from "../db";
import {
  appointments,
  auditEvents,
  callbackRequests,
  callPatients,
  calls,
  followUpPlans,
  followUpVisits,
  notifications,
  patients,
  practitioners,
  services,
  type Call,
} from "../db/schema";
import { sameFullName } from "./appointments";
import { practitionerDisplayName, type ClinicContext } from "./clinics";
import { DomainError, isUniqueViolation } from "./errors";
import { recomputePlansForAppointment } from "./follow-ups";
import { detachPatientNotifications } from "./notifications";
import { patientsPerName } from "./patients-per-name";
import { testCallFlag } from "./test-calls";
import { enqueueProviderDeletions } from "./provider-deletions";
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
  /**
   * PATIENTS_PER_NAME: who the booking was for, when that differs from the
   * patient record (a family member on a shared number). Null otherwise.
   */
  bookedForName: string | null;
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
      bookedForName: appointments.bookedForName,
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

function toPanelAppointment(
  row: AppointmentRow,
  timeZone: string,
  perName: boolean = patientsPerName(),
): PanelAppointment {
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
    bookedForName:
      perName && row.bookedForName && !sameFullName(row.bookedForName, row.patientName)
        ? row.bookedForName
        : null,
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

const APPOINTMENT_SORT_COLUMNS = {
  tarih: appointments.startsAt,
  hasta: patients.fullName,
  hizmet: services.name,
  hekim: practitioners.name,
  durum: appointments.status,
} as const;

/** A chosen column first, then time; without one, the period's own order. */
function appointmentOrder(options: { order?: "asc" | "desc"; sort?: Sort<AppointmentSortKey> }) {
  const byTime =
    options.order === "desc" ? desc(appointments.startsAt) : asc(appointments.startsAt);
  if (!options.sort) return [byTime];
  const column = APPOINTMENT_SORT_COLUMNS[options.sort.key];
  const primary = options.sort.direction === "azalan" ? desc(column) : asc(column);
  return options.sort.key === "tarih" ? [primary] : [primary, byTime];
}

export async function listAppointments(
  exec: Executor,
  scope: PanelScope,
  filter: AppointmentFilter,
  options: {
    limit?: number;
    offset?: number;
    order?: "asc" | "desc";
    sort?: Sort<AppointmentSortKey>;
    /** PATIENTS_PER_NAME: the search also matches who a booking was for. */
    perName?: boolean;
  } = {},
): Promise<{ rows: PanelAppointment[]; total: number }> {
  const { start, end } = dayRange(scope, filter.from, filter.to);
  const perName = options.perName ?? patientsPerName();
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
            ilike(patients.fullName, containing(search)),
            ...(digits && digits.length >= 3 ? [ilike(patients.phone, `%${digits}%`)] : []),
            ...(perName ? [ilike(appointments.bookedForName, containing(search))] : []),
          )!,
        ]
      : []),
  ];

  const [rows, [total]] = await Promise.all([
    appointmentQuery(exec)
      .where(and(...conditions))
      .orderBy(...appointmentOrder(options))
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

/**
 * Whether the call with this id is currently marked as a test call
 * (TEST_CALL_FLAG, R2 5e): the latest "call.marked_test" audit event decides.
 */
function markedTest(callId: '"calls"."id"' | '"appointments"."call_id"') {
  // Qualified by hand: without a join Drizzle prints a bare "id", which the
  // subquery would read as the audit row's own id.
  return sql`coalesce((
    select ae.metadata->>'test' from ${auditEvents} ae
    where ae.action = 'call.marked_test' and ae.target_id = (${sql.raw(callId)})::text
    order by ae.created_at desc limit 1
  ), 'false') = 'true'`;
}

/** Whether a call is marked as a test call (TEST_CALL_FLAG, R2 5e). */
export async function isTestCall(exec: Executor, clinicId: string, callId: string) {
  const [row] = await exec
    .select({ test: markedTest('"calls"."id"') })
    .from(calls)
    .where(and(eq(calls.clinicId, clinicId), eq(calls.id, callId)));
  return row?.test === true;
}

/**
 * An ILIKE pattern that matches the text literally anywhere: "%" and "_" in
 * what staff type are not wildcards (audit P-23, gap review G-07).
 */
export function containing(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/** The "Bugün" screen: today's calendar and the numbers above it. */
export async function todayOverview(
  exec: Executor,
  scope: PanelScope,
  now: Date,
  /** TEST_CALL_FLAG: calls marked as tests, and their bookings, are not counted. */
  excludeTestCalls: boolean = testCallFlag(),
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
          excludeTestCalls
            ? or(isNull(appointments.callId), not(markedTest('"appointments"."call_id"')))
            : undefined,
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
          excludeTestCalls ? not(markedTest('"calls"."id"')) : undefined,
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

  // Only from the status just read: a change made meanwhile is not overwritten (FA-17).
  const changed = await exec
    .update(appointments)
    .set({
      status: input.status,
      cancelledAt: input.status === "cancelled" ? input.now : null,
    })
    .where(
      and(
        eq(appointments.clinicId, scope.clinicId),
        eq(appointments.id, input.appointmentId),
        eq(appointments.status, current.status),
      ),
    )
    .returning({ id: appointments.id });
  if (changed.length === 0) {
    throw new DomainError(
      "APPOINTMENT_CHANGED",
      "Randevu bu sırada değişti. Sayfayı yenileyip tekrar deneyin.",
    );
  }
  // A correction ("Gelmedi", "Tamamlandı") changes what the follow-up counts.
  await recomputePlansForAppointment(
    exec,
    { clinicId: scope.clinicId, timeZone: scope.timeZone },
    input.appointmentId,
    input.now,
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

// ─── Calls ───────────────────────────────────────────────────────────────────

export interface PanelCall {
  id: string;
  fromNumber: string | null;
  startedAt: Date | null;
  createdAt: Date;
  durationSeconds: number | null;
  outcome: Call["outcome"];
  summary: string | null;
  hasTranscript: boolean;
  hasRecording: boolean;
  /** Post-call flags (POST_CALL_FLAGS); null when the call was not checked. */
  flags: CallFlag[] | null;
  /** Patient whose phone matches the caller, if known to the clinic. */
  patientId: string | null;
  patientName: string | null;
}

/**
 * The one patient shown for a call, even when several patients share the
 * caller's number (P-12): the oldest patient on that number, which is what
 * the old join on phone returned under the unique (clinic_id, phone) index.
 * With PATIENTS_PER_NAME the patient the call was about (call_patients) on
 * that number comes first.
 */
function callPatientId(perName: boolean) {
  const oldest = sql`(select op.id from ${patients} op
    where op.clinic_id = ${calls.clinicId} and op.phone = ${calls.fromNumber}
    order by op.created_at, op.id limit 1)`;
  if (!perName) return oldest;
  const linked = sql`(select lp.id from ${callPatients} cp join ${patients} lp on lp.id = cp.patient_id
    where cp.call_id = ${calls.id} and lp.clinic_id = ${calls.clinicId} and lp.phone = ${calls.fromNumber}
    order by lp.created_at, lp.id limit 1)`;
  return sql`coalesce(${linked}, ${oldest})`;
}

export async function listCalls(
  exec: Executor,
  clinicId: string,
  options: { outcome?: NonNullable<Call["outcome"]>; limit: number; offset: number },
  perName: boolean = patientsPerName(),
): Promise<{ rows: PanelCall[]; total: number }> {
  const conditions = [
    eq(calls.clinicId, clinicId),
    ...(options.outcome ? [eq(calls.outcome, options.outcome)] : []),
  ];
  const [rows, [total]] = await Promise.all([
    exec
      .select({
        id: calls.id,
        fromNumber: calls.fromNumber,
        startedAt: calls.startedAt,
        createdAt: calls.createdAt,
        durationSeconds: calls.durationSeconds,
        outcome: calls.outcome,
        summary: calls.summary,
        hasTranscript: sql<boolean>`${calls.transcript} is not null`,
        hasRecording: sql<boolean>`${calls.recordingUrl} is not null`,
        flags: calls.flags,
        patientId: patients.id,
        patientName: patients.fullName,
      })
      .from(calls)
      .leftJoin(
        patients,
        and(eq(patients.clinicId, calls.clinicId), eq(patients.id, callPatientId(perName))),
      )
      .where(and(...conditions))
      .orderBy(desc(calls.createdAt))
      .limit(options.limit)
      .offset(options.offset),
    exec
      .select({ value: count() })
      .from(calls)
      .where(and(...conditions)),
  ]);
  return {
    rows: rows.map((row) => ({ ...row, flags: (row.flags as CallFlag[] | null) ?? null })),
    total: total?.value ?? 0,
  };
}

export interface PanelCallDetail extends PanelCall {
  clinicId: string;
  endedReason: string | null;
  transcript: string | null;
  recordingUrl: string | null;
  provider: string;
  providerCallId: string;
  appointments: PanelAppointment[];
}

export async function getCall(
  exec: Executor,
  scope: PanelScope,
  callId: string,
  perName: boolean = patientsPerName(),
): Promise<PanelCallDetail | null> {
  const [row] = await exec
    .select({ call: calls, patientId: patients.id, patientName: patients.fullName })
    .from(calls)
    .leftJoin(
      patients,
      and(eq(patients.clinicId, calls.clinicId), eq(patients.id, callPatientId(perName))),
    )
    .where(and(eq(calls.clinicId, scope.clinicId), eq(calls.id, callId)));
  if (!row) return null;

  const linked = await appointmentQuery(exec)
    .where(and(...scopeConditions(scope), eq(appointments.callId, callId)))
    .orderBy(asc(appointments.startsAt));
  const { call } = row;
  return {
    id: call.id,
    fromNumber: call.fromNumber,
    startedAt: call.startedAt,
    createdAt: call.createdAt,
    durationSeconds: call.durationSeconds,
    outcome: call.outcome,
    summary: call.summary,
    hasTranscript: call.transcript !== null,
    hasRecording: call.recordingUrl !== null,
    flags: (call.flags as CallFlag[] | null) ?? null,
    patientId: row.patientId,
    patientName: row.patientName,
    clinicId: call.clinicId,
    endedReason: call.endedReason,
    transcript: call.transcript,
    recordingUrl: call.recordingUrl,
    provider: call.provider,
    providerCallId: call.providerCallId,
    appointments: linked.map((a) => toPanelAppointment(a, scope.timeZone)),
  };
}

// ─── Patients ────────────────────────────────────────────────────────────────

export interface PanelPatient {
  id: string;
  fullName: string;
  phone: string;
  notes: string | null;
  createdAt: Date;
  appointmentCount: number;
  lastAppointmentAt: Date | null;
  nextAppointmentAt: Date | null;
}

/** Marker for anonymised patients; the phone column must stay unique per clinic. */
export const ANONYMIZED_PREFIX = "anon:";

/** Patients by name unless a column is chosen; empty dates go last either way. */
function patientOrder(
  sort: Sort<PatientSortKey> | undefined,
  stats: {
    appointmentCount: SQLWrapper;
    lastAppointmentAt: SQLWrapper;
    nextAppointmentAt: SQLWrapper;
  },
) {
  const byName = asc(patients.fullName);
  if (!sort || sort.key === "ad") {
    return [sort?.direction === "azalan" ? desc(patients.fullName) : byName];
  }
  const column = {
    randevu: sql`coalesce(${stats.appointmentCount}, 0)`,
    son: sql`${stats.lastAppointmentAt}`,
    siradaki: sql`${stats.nextAppointmentAt}`,
  }[sort.key];
  const direction = sort.direction === "azalan" ? sql`desc nulls last` : sql`asc nulls last`;
  return [sql`${column} ${direction}`, byName];
}

export async function listPatients(
  exec: Executor,
  scope: PanelScope,
  options: {
    search?: string;
    limit: number;
    offset: number;
    now: Date;
    sort?: Sort<PatientSortKey>;
  },
): Promise<{ rows: PanelPatient[]; total: number }> {
  const search = options.search?.trim();
  const digits = search?.replace(/\D/g, "");
  const conditions = [
    eq(patients.clinicId, scope.clinicId),
    notLike(patients.phone, `${ANONYMIZED_PREFIX}%`),
    ...(search
      ? [
          or(
            ilike(patients.fullName, containing(search)),
            ...(digits && digits.length >= 3 ? [ilike(patients.phone, `%${digits}%`)] : []),
          )!,
        ]
      : []),
    // A practitioner sees only patients they have treated or will treat.
    ...(scope.practitionerId
      ? [
          exists(
            exec
              .select({ one: sql`1` })
              .from(appointments)
              .where(
                and(
                  eq(appointments.patientId, patients.id),
                  eq(appointments.practitionerId, scope.practitionerId),
                ),
              ),
          ),
        ]
      : []),
  ];

  const active = inArray(appointments.status, [...ACTIVE_APPOINTMENT_STATUSES]);
  const stats = exec
    .select({
      patientId: appointments.patientId,
      appointmentCount: count().as("appointment_count"),
      lastAppointmentAt: sql<
        string | null
      >`max(${appointments.startsAt}) filter (where ${lte(appointments.startsAt, options.now)})`.as(
        "last_appointment_at",
      ),
      nextAppointmentAt: sql<
        string | null
      >`min(${appointments.startsAt}) filter (where ${and(gt(appointments.startsAt, options.now), active)})`.as(
        "next_appointment_at",
      ),
    })
    .from(appointments)
    .where(eq(appointments.clinicId, scope.clinicId))
    .groupBy(appointments.patientId)
    .as("stats");

  const [rows, [total]] = await Promise.all([
    exec
      .select({
        id: patients.id,
        fullName: patients.fullName,
        phone: patients.phone,
        notes: patients.notes,
        createdAt: patients.createdAt,
        appointmentCount: sql<number>`coalesce(${stats.appointmentCount}, 0)::int`,
        lastAppointmentAt: stats.lastAppointmentAt,
        nextAppointmentAt: stats.nextAppointmentAt,
      })
      .from(patients)
      .leftJoin(stats, eq(stats.patientId, patients.id))
      .where(and(...conditions))
      .orderBy(...patientOrder(options.sort, stats))
      .limit(options.limit)
      .offset(options.offset),
    exec
      .select({ value: count() })
      .from(patients)
      .where(and(...conditions)),
  ]);
  return {
    rows: rows.map((row) => ({
      ...row,
      lastAppointmentAt: row.lastAppointmentAt ? new Date(row.lastAppointmentAt) : null,
      nextAppointmentAt: row.nextAppointmentAt ? new Date(row.nextAppointmentAt) : null,
    })),
    total: total?.value ?? 0,
  };
}

export async function getPatient(exec: Executor, scope: PanelScope, patientId: string) {
  const [patient] = await exec
    .select({
      id: patients.id,
      fullName: patients.fullName,
      phone: patients.phone,
      notes: patients.notes,
      smsOptOutAt: patients.smsOptOutAt,
      createdAt: patients.createdAt,
    })
    .from(patients)
    .where(and(eq(patients.clinicId, scope.clinicId), eq(patients.id, patientId)));
  if (!patient || patient.phone.startsWith(ANONYMIZED_PREFIX)) return null;

  const history = await appointmentQuery(exec)
    .where(and(...scopeConditions(scope), eq(appointments.patientId, patientId)))
    .orderBy(desc(appointments.startsAt));
  if (scope.practitionerId && history.length === 0) return null;
  return { patient, appointments: history.map((a) => toPanelAppointment(a, scope.timeZone)) };
}

export async function updatePatientNotes(
  exec: Executor,
  clinicId: string,
  input: { patientId: string; notes: string },
): Promise<void> {
  const updated = await exec
    .update(patients)
    .set({ notes: input.notes.trim() || null })
    .where(and(eq(patients.clinicId, clinicId), eq(patients.id, input.patientId)))
    .returning({ id: patients.id });
  if (updated.length === 0) throw new DomainError("NOT_FOUND", "Hasta bulunamadı.");
}

/**
 * Corrects a patient's name and phone (KVKK m.11, gap review G-02). Returns
 * the names of the fields that changed, for the audit record (never values).
 * While the unique (clinic_id, phone) index exists, a phone that another
 * patient already has is refused.
 */
export async function updatePatientIdentity(
  exec: Executor,
  clinicId: string,
  input: { patientId: string; fullName: string; phone: string },
): Promise<("fullName" | "phone")[]> {
  const phone = normalizePhone(input.phone);
  if (!phone) {
    throw new DomainError(
      "INVALID_PHONE",
      "Telefon numarası geçersiz; sıfırla başlayan on bir hane girin.",
    );
  }
  const fullName = personName(input.fullName);
  const [current] = await exec
    .select({ fullName: patients.fullName, phone: patients.phone })
    .from(patients)
    .where(and(eq(patients.clinicId, clinicId), eq(patients.id, input.patientId)));
  if (!current || current.phone.startsWith(ANONYMIZED_PREFIX)) {
    throw new DomainError("NOT_FOUND", "Hasta bulunamadı.");
  }
  const changed = [
    ...(current.fullName !== fullName ? (["fullName"] as const) : []),
    ...(current.phone !== phone ? (["phone"] as const) : []),
  ];
  if (changed.length === 0) return [];
  try {
    await exec.transaction(async (tx) => {
      await tx
        .update(patients)
        .set({ fullName, phone, updatedAt: sql`now()` })
        .where(and(eq(patients.clinicId, clinicId), eq(patients.id, input.patientId)));
      if (current.phone !== phone) {
        await keepHistoryOnNewPhone(tx, clinicId, input.patientId, current.phone, phone);
      }
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DomainError("PHONE_TAKEN", "Bu numara başka bir hastanın kaydında var.");
    }
    throw error;
  }
  return changed;
}

/**
 * After a phone correction, export and erasure find calls and callback notes
 * by the new number, so the old number's history would drop out of both
 * (full audit FA-02). While the patient was alone on the old number, that
 * history is theirs: its calls are linked to the patient (`call_patients`)
 * and its callback notes take the corrected number. When family members
 * still share the old number nothing moves; calls already linked to the
 * patient stay linked, the rest stays with the number (as in exportCallScope).
 */
async function keepHistoryOnNewPhone(
  tx: Executor,
  clinicId: string,
  patientId: string,
  oldPhone: string,
  newPhone: string,
): Promise<void> {
  const [family] = await tx
    .select({ id: patients.id })
    .from(patients)
    .where(
      and(
        eq(patients.clinicId, clinicId),
        eq(patients.phone, oldPhone),
        ne(patients.id, patientId),
      ),
    )
    .limit(1);
  if (family) return;

  const fromOld = await tx
    .select({ id: calls.id })
    .from(calls)
    .where(and(eq(calls.clinicId, clinicId), eq(calls.fromNumber, oldPhone)));
  if (fromOld.length > 0) {
    await tx
      .insert(callPatients)
      .values(fromOld.map((call) => ({ clinicId, callId: call.id, patientId })))
      .onConflictDoNothing();
  }
  await tx
    .update(callbackRequests)
    .set({ phone: newPhone })
    .where(
      and(
        eq(callbackRequests.clinicId, clinicId),
        eq(callbackRequests.phone, oldPhone),
        // One open note per call and number: never collide with one already on the new number.
        sql`not exists (
          select 1 from ${callbackRequests} other
          where other.clinic_id = ${callbackRequests.clinicId}
            and other.call_id = ${callbackRequests.callId}
            and other.phone = ${newPhone}
            and other.status = 'open'
        )`,
      ),
    );
}

/**
 * Calls from a shared number that belong only to other patients on it (P-12):
 * linked to one of them and not to the patient being erased. Empty while the
 * number has one patient, which is always the case before the P-12 migration (0021).
 */
async function familyCallIds(
  tx: Executor,
  clinicId: string,
  patientId: string,
  phone: string,
  ownCallIds: string[],
): Promise<string[]> {
  const family = await tx
    .select({ id: patients.id })
    .from(patients)
    .where(
      and(eq(patients.clinicId, clinicId), eq(patients.phone, phone), ne(patients.id, patientId)),
    );
  if (family.length === 0) return [];
  const familyIds = family.map((member) => member.id);
  const [linked, creating] = await Promise.all([
    tx
      .select({ callId: callPatients.callId })
      .from(callPatients)
      .where(and(eq(callPatients.clinicId, clinicId), inArray(callPatients.patientId, familyIds))),
    tx
      .select({ callId: appointments.callId })
      .from(appointments)
      .where(
        and(
          eq(appointments.clinicId, clinicId),
          inArray(appointments.patientId, familyIds),
          isNotNull(appointments.callId),
        ),
      ),
  ]);
  const own = new Set(ownCallIds);
  return [
    ...new Set(
      [...linked, ...creating].flatMap((row) =>
        row.callId && !own.has(row.callId) ? [row.callId] : [],
      ),
    ),
  ];
}

/** Replaces a callback note's free text, which may describe a complaint. */
export const ANONYMIZED_CALLBACK_REASON = "(anonimleştirildi)";

/**
 * KVKK erasure request: removes the patient's identity from the clinic's
 * records while keeping appointment history for statistics. Not reversible.
 *
 * Calls about the patient lose the number, transcript, summary and recording
 * link, whatever number they came from (audit P-09): calls from the patient's
 * number, calls linked to the patient (`call_patients`: booked, found,
 * cancelled or moved its appointments, including withheld numbers) and calls
 * that created its appointments. Callback notes from those calls or that
 * number lose name, number and text. The provider's copies (audio) are queued
 * for deletion in the same transaction (audit P-10).
 *
 * Family members with their own records on the same number (P-12): a call
 * from the number that is linked only to one of them is theirs and is kept,
 * with its recording and callback notes; a call linked to this patient, or to
 * nobody, is erased. With one patient per number nothing differs.
 *
 * Returns the provider ids of the erased calls.
 */
export async function anonymizePatient(
  db: Executor,
  clinicId: string,
  patientId: string,
  now: Date = new Date(),
): Promise<{ provider: string; providerCallId: string }[]> {
  return db.transaction(async (tx) => {
    const [patient] = await tx
      .select({ phone: patients.phone })
      .from(patients)
      .where(and(eq(patients.clinicId, clinicId), eq(patients.id, patientId)))
      .for("update");
    if (!patient || patient.phone.startsWith(ANONYMIZED_PREFIX)) {
      throw new DomainError("NOT_FOUND", "Hasta bulunamadı.");
    }

    const [linked, creating] = await Promise.all([
      tx
        .select({ callId: callPatients.callId })
        .from(callPatients)
        .where(and(eq(callPatients.clinicId, clinicId), eq(callPatients.patientId, patientId))),
      tx
        .select({ callId: appointments.callId })
        .from(appointments)
        .where(
          and(
            eq(appointments.clinicId, clinicId),
            eq(appointments.patientId, patientId),
            isNotNull(appointments.callId),
          ),
        ),
    ]);
    const linkedCallIds = [
      ...new Set([...linked, ...creating].flatMap((row) => (row.callId ? [row.callId] : []))),
    ];
    const keptCallIds = await familyCallIds(tx, clinicId, patientId, patient.phone, linkedCallIds);

    const erasedCalls = await tx
      .update(calls)
      .set({ fromNumber: null, transcript: null, summary: null, recordingUrl: null })
      .where(
        and(
          eq(calls.clinicId, clinicId),
          or(
            and(
              eq(calls.fromNumber, patient.phone),
              keptCallIds.length > 0 ? notInArray(calls.id, keptCallIds) : undefined,
            ),
            linkedCallIds.length > 0 ? inArray(calls.id, linkedCallIds) : undefined,
          ),
        ),
      )
      .returning({ id: calls.id, provider: calls.provider, providerCallId: calls.providerCallId });
    const erasedCallIds = erasedCalls.map((call) => call.id);
    await tx
      .update(callbackRequests)
      .set({ patientName: null, phone: null, reason: ANONYMIZED_CALLBACK_REASON })
      .where(
        and(
          eq(callbackRequests.clinicId, clinicId),
          or(
            and(
              eq(callbackRequests.phone, patient.phone),
              keptCallIds.length > 0
                ? or(
                    isNull(callbackRequests.callId),
                    notInArray(callbackRequests.callId, keptCallIds),
                  )
                : undefined,
            ),
            erasedCallIds.length > 0 ? inArray(callbackRequests.callId, erasedCallIds) : undefined,
          ),
        ),
      );
    const providerCalls = erasedCalls.map(({ provider, providerCallId }) => ({
      provider,
      providerCallId,
    }));
    await enqueueProviderDeletions(tx, clinicId, providerCalls, "patient_anonymized", now);
    // The booked-for name is a person's name on this record (full audit FA-01).
    await tx
      .update(appointments)
      .set({ notes: null, bookedForName: null })
      .where(and(eq(appointments.clinicId, clinicId), eq(appointments.patientId, patientId)));
    await detachPatientNotifications(tx, clinicId, patientId);
    // Follow-up plans reveal treatments; they go with the identity (visits cascade).
    await tx
      .delete(followUpPlans)
      .where(and(eq(followUpPlans.clinicId, clinicId), eq(followUpPlans.patientId, patientId)));
    await tx
      .update(patients)
      .set({
        fullName: "Anonimleştirilmiş hasta",
        phone: `${ANONYMIZED_PREFIX}${patientId}`,
        notes: null,
        kvkkNoticeAt: null,
      })
      .where(and(eq(patients.clinicId, clinicId), eq(patients.id, patientId)));
    return providerCalls;
  });
}

/** Calls linked to a patient: call_patients and calls that created its appointments. */
async function ownCallIds(exec: Executor, clinicId: string, patientId: string): Promise<string[]> {
  const [linked, creating] = await Promise.all([
    exec
      .select({ callId: callPatients.callId })
      .from(callPatients)
      .where(and(eq(callPatients.clinicId, clinicId), eq(callPatients.patientId, patientId))),
    exec
      .select({ callId: appointments.callId })
      .from(appointments)
      .where(
        and(
          eq(appointments.clinicId, clinicId),
          eq(appointments.patientId, patientId),
          isNotNull(appointments.callId),
        ),
      ),
  ]);
  return [...new Set([...linked, ...creating].flatMap((row) => (row.callId ? [row.callId] : [])))];
}

/**
 * Which calls and callback notes an export may contain (F-02, P-12).
 *
 * Always: calls linked to the patient, from any number (also withheld), and
 * notes from those calls. While the patient is the only one on the number:
 * also every call and note from the number, as before. When other patients
 * share the number: only the linked ones; calls and notes from the number
 * that are linked to nobody are left out and counted, and those linked only
 * to the others are left out silently (they are theirs).
 */
async function exportCallScope(exec: Executor, clinicId: string, patientId: string, phone: string) {
  const own = await ownCallIds(exec, clinicId, patientId);
  const family = await exec
    .select({ id: patients.id })
    .from(patients)
    .where(
      and(eq(patients.clinicId, clinicId), eq(patients.phone, phone), ne(patients.id, patientId)),
    );
  if (family.length === 0) {
    return {
      calls: or(eq(calls.fromNumber, phone), own.length > 0 ? inArray(calls.id, own) : undefined),
      callbacks: (callIds: string[]) =>
        or(
          eq(callbackRequests.phone, phone),
          callIds.length > 0 ? inArray(callbackRequests.callId, callIds) : undefined,
        ),
      omitted: { calls: 0, callbacks: 0 },
    };
  }

  const familyCalls = (
    await Promise.all(family.map((member) => ownCallIds(exec, clinicId, member.id)))
  ).flat();
  const attributed = [...new Set([...own, ...familyCalls])];
  const [[unlinkedCalls], [unlinkedNotes]] = await Promise.all([
    exec
      .select({ value: count() })
      .from(calls)
      .where(
        and(
          eq(calls.clinicId, clinicId),
          eq(calls.fromNumber, phone),
          attributed.length > 0 ? notInArray(calls.id, attributed) : undefined,
        ),
      ),
    exec
      .select({ value: count() })
      .from(callbackRequests)
      .where(
        and(
          eq(callbackRequests.clinicId, clinicId),
          eq(callbackRequests.phone, phone),
          attributed.length > 0
            ? or(isNull(callbackRequests.callId), notInArray(callbackRequests.callId, attributed))
            : undefined,
        ),
      ),
  ]);
  return {
    calls: own.length > 0 ? inArray(calls.id, own) : sql`false`,
    callbacks: (callIds: string[]) =>
      callIds.length > 0 ? inArray(callbackRequests.callId, callIds) : sql`false`,
    omitted: { calls: unlinkedCalls?.value ?? 0, callbacks: unlinkedNotes?.value ?? 0 },
  };
}

/**
 * KVKK access request (m.11): everything the clinic holds on one patient, in
 * a portable shape. Labels are Turkish because the file goes to the patient.
 */
export async function exportPatientData(exec: Executor, scope: PanelScope, patientId: string) {
  const found = await getPatient(exec, scope, patientId);
  if (!found) return null;
  const { patient } = found;
  const callScope = await exportCallScope(exec, scope.clinicId, patient.id, patient.phone);

  const callRows = await exec
    .select({
      id: calls.id,
      startedAt: calls.startedAt,
      createdAt: calls.createdAt,
      durationSeconds: calls.durationSeconds,
      outcome: calls.outcome,
      summary: calls.summary,
      transcript: calls.transcript,
      hasRecording: sql<boolean>`${calls.recordingUrl} is not null`,
    })
    .from(calls)
    .where(and(eq(calls.clinicId, scope.clinicId), callScope.calls))
    .orderBy(desc(calls.createdAt));

  const [callbackRows, notificationRows, planRows, visitRows] = await Promise.all([
    exec
      .select({
        createdAt: callbackRequests.createdAt,
        reason: callbackRequests.reason,
        status: callbackRequests.status,
        resolvedAt: callbackRequests.resolvedAt,
      })
      .from(callbackRequests)
      .where(
        and(
          eq(callbackRequests.clinicId, scope.clinicId),
          callScope.callbacks(callRows.map((c) => c.id)),
        ),
      )
      .orderBy(desc(callbackRequests.createdAt)),
    exec
      .select({
        kind: notifications.kind,
        status: notifications.status,
        skipReason: notifications.skipReason,
        createdAt: notifications.createdAt,
        sentAt: notifications.sentAt,
      })
      .from(notifications)
      .where(
        and(eq(notifications.clinicId, scope.clinicId), eq(notifications.patientId, patient.id)),
      )
      .orderBy(desc(notifications.createdAt)),
    exec
      .select({
        id: followUpPlans.id,
        name: followUpPlans.name,
        state: followUpPlans.state,
        startedOn: followUpPlans.startedOn,
        nextDueOn: followUpPlans.nextDueOn,
        visitsDone: followUpPlans.visitsDone,
        totalVisits: followUpPlans.totalVisits,
        smsConsentAt: followUpPlans.smsConsentAt,
      })
      .from(followUpPlans)
      .where(
        and(eq(followUpPlans.clinicId, scope.clinicId), eq(followUpPlans.patientId, patient.id)),
      ),
    exec
      .select({
        planId: followUpVisits.planId,
        visitedOn: followUpVisits.visitedOn,
        source: followUpVisits.source,
        appointmentStartsAt: appointments.startsAt,
        appointmentStatus: appointments.status,
      })
      .from(followUpVisits)
      .innerJoin(
        followUpPlans,
        and(
          eq(followUpPlans.clinicId, followUpVisits.clinicId),
          eq(followUpPlans.id, followUpVisits.planId),
        ),
      )
      .leftJoin(
        appointments,
        and(
          eq(appointments.clinicId, followUpVisits.clinicId),
          eq(appointments.id, followUpVisits.appointmentId),
        ),
      )
      .where(
        and(eq(followUpVisits.clinicId, scope.clinicId), eq(followUpPlans.patientId, patient.id)),
      ),
  ]);

  return {
    hasta: {
      adSoyad: patient.fullName,
      telefon: patient.phone,
      not: patient.notes,
      kayitTarihi: patient.createdAt,
    },
    randevular: found.appointments.map((a) => ({
      baslangic: a.startsAt,
      bitis: a.endsAt,
      hizmet: a.serviceName,
      hekim: a.practitionerName,
      durum: a.status,
      kaynak: a.source,
      not: a.notes,
      olusturulma: a.createdAt,
    })),
    aramalar: callRows.map((c) => ({
      tarih: c.startedAt ?? c.createdAt,
      sureSaniye: c.durationSeconds,
      sonuc: c.outcome,
      ozet: c.summary,
      dokum: c.transcript,
      sesKaydiVar: c.hasRecording,
    })),
    takipler: planRows.map((p) => ({
      ad: p.name,
      durum: p.state,
      baslangic: p.startedOn,
      sonrakiTarih: p.nextDueOn,
      ziyaretSayisi: p.visitsDone,
      toplamZiyaret: p.totalVisits,
      smsOnayi: p.smsConsentAt,
      ziyaretler: visitRows
        .filter((v) => v.planId === p.id)
        .map((v) => ({
          tarih: v.visitedOn ?? v.appointmentStartsAt,
          kaynak: v.source,
          randevuDurumu: v.appointmentStatus,
        })),
    })),
    // What was sent and when; message texts are never stored.
    bildirimler: notificationRows.map((n) => ({
      tur: n.kind,
      durum: n.status,
      gonderilmemeSebebi: n.skipReason,
      olusturulma: n.createdAt,
      gonderim: n.sentAt,
    })),
    geriAramaTalepleri: callbackRows.map((c) => ({
      tarih: c.createdAt,
      sebep: c.reason,
      durum: c.status,
      kapanis: c.resolvedAt,
    })),
    ...(callScope.omitted.calls + callScope.omitted.callbacks > 0 && {
      eklenmeyenler: {
        aramalar: callScope.omitted.calls,
        geriAramaTalepleri: callScope.omitted.callbacks,
        aciklama:
          "Bu telefon numarası kliniğin başka hastalarınca da kullanılıyor. Numaradan gelen ama hiçbir hastaya bağlanamayan aramalar ve geri arama talepleri, başka birine ait olabileceği için bu dosyaya eklenmedi. Gerekirse klinik bunları sizinle birlikte inceleyebilir.",
      },
    }),
  };
}

/**
 * Channel-level opt-out ("SMS istemiyor"). Pending messages are dropped at
 * once; the dispatcher also re-checks it before every send.
 */
export async function setPatientSmsOptOut(
  exec: Executor,
  clinicId: string,
  patientId: string,
  optOut: boolean,
  now: Date,
): Promise<void> {
  const updated = await exec
    .update(patients)
    .set({ smsOptOutAt: optOut ? now : null })
    .where(and(eq(patients.clinicId, clinicId), eq(patients.id, patientId)))
    .returning({ id: patients.id });
  if (updated.length === 0) throw new DomainError("NOT_FOUND", "Hasta bulunamadı.");
  if (optOut) {
    await exec
      .update(notifications)
      .set({ status: "skipped", skipReason: "opted_out", lockedAt: null })
      .where(
        and(
          eq(notifications.clinicId, clinicId),
          eq(notifications.patientId, patientId),
          eq(notifications.status, "pending"),
        ),
      );
  }
}

/** Staff reports of wrong assistant behaviour on one call (CALL_REVIEW, R2 5d). */
export async function listCallReports(exec: Executor, clinicId: string, callId: string) {
  const rows = await exec
    .select({ metadata: auditEvents.metadata, createdAt: auditEvents.createdAt })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.clinicId, clinicId),
        eq(auditEvents.action, "call.reported"),
        eq(auditEvents.targetId, callId),
      ),
    )
    .orderBy(desc(auditEvents.createdAt));
  return rows.flatMap((row) => {
    const reason = (row.metadata as { reason?: unknown }).reason;
    return (CALL_REPORT_REASONS as readonly unknown[]).includes(reason)
      ? [{ reason: reason as CallReportReason, createdAt: row.createdAt }]
      : [];
  });
}
