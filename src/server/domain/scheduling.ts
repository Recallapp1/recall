import "server-only";

import { and, eq, gt, inArray, isNull, lt, or } from "drizzle-orm";

import type { Executor } from "../db";
import {
  ACTIVE_APPOINTMENT_STATUSES,
  appointments,
  practitionerServices,
  practitioners,
  services,
  timeOff,
  workingHours,
  type Service,
} from "../db/schema";
import {
  computeSlots,
  type Interval,
  type Slot,
  type TimeOfDay,
  type WeeklyRange,
} from "./availability";
import type { ClinicContext } from "./clinics";
import { practitionerDisplayName } from "./clinics";
import { DomainError } from "./errors";
import { addLocalDays, isLocalDate, localToUtc, type LocalDate } from "./time";

const NEXT_DATES_LOOKAHEAD_DAYS = 14;
const NEXT_DATES_COUNT = 3;

export interface AvailabilityQuery {
  serviceId: string;
  date: LocalDate;
  practitionerId?: string;
  timeOfDay?: TimeOfDay;
  /** Appointment to ignore, so rescheduling can offer the patient's own slot back. */
  excludeAppointmentId?: string;
  now: Date;
}

export interface AvailabilityResult {
  service: Pick<Service, "id" | "name" | "durationMinutes">;
  slots: Slot[];
  nextAvailableDates: LocalDate[];
}

export async function getServiceForClinic(exec: Executor, clinicId: string, serviceId: string) {
  const [service] = await exec
    .select()
    .from(services)
    .where(
      and(eq(services.id, serviceId), eq(services.clinicId, clinicId), eq(services.isActive, true)),
    );
  if (!service) {
    throw new DomainError("INVALID_SERVICE", "Bu hizmeti bulamadım.");
  }
  return service;
}

/**
 * Active practitioners who can perform a service. A service with no explicit
 * practitioner mapping can be performed by everyone.
 */
export async function eligiblePractitioners(exec: Executor, clinicId: string, serviceId: string) {
  const [active, mapped] = await Promise.all([
    exec
      .select({ id: practitioners.id, name: practitioners.name, title: practitioners.title })
      .from(practitioners)
      .where(and(eq(practitioners.clinicId, clinicId), eq(practitioners.isActive, true))),
    exec
      .select({ practitionerId: practitionerServices.practitionerId })
      .from(practitionerServices)
      .where(eq(practitionerServices.serviceId, serviceId)),
  ]);
  if (mapped.length === 0) return active;
  const allowed = new Set(mapped.map((row) => row.practitionerId));
  return active.filter((p) => allowed.has(p.id));
}

/** Slots for one day, plus the next days with availability when that day is full. */
export async function findAvailability(
  exec: Executor,
  { clinic, settings }: ClinicContext,
  query: AvailabilityQuery,
): Promise<AvailabilityResult> {
  if (!isLocalDate(query.date)) {
    throw new DomainError("INVALID_DATE", "Tarihi anlayamadım.");
  }

  const service = await getServiceForClinic(exec, clinic.id, query.serviceId);
  let candidates = await eligiblePractitioners(exec, clinic.id, service.id);
  if (query.practitionerId) {
    candidates = candidates.filter((p) => p.id === query.practitionerId);
    if (candidates.length === 0) {
      throw new DomainError("INVALID_PRACTITIONER", "Bu hekim seçilen hizmeti vermiyor.");
    }
  }

  const serviceSummary = {
    id: service.id,
    name: service.name,
    durationMinutes: service.durationMinutes,
  };
  if (candidates.length === 0) {
    return { service: serviceSummary, slots: [], nextAvailableDates: [] };
  }

  const lastDate = addLocalDays(query.date, NEXT_DATES_LOOKAHEAD_DAYS);
  const schedule = await loadSchedule(exec, {
    clinicId: clinic.id,
    timeZone: clinic.timezone,
    practitionerIds: candidates.map((p) => p.id),
    fromDate: query.date,
    toDate: lastDate,
    excludeAppointmentId: query.excludeAppointmentId,
  });

  const slotsFor = (date: LocalDate, timeOfDay?: TimeOfDay) =>
    computeSlots({
      date,
      timeZone: clinic.timezone,
      now: query.now,
      durationMinutes: service.durationMinutes,
      slotIntervalMinutes: settings.booking.slotIntervalMinutes,
      minNoticeMinutes: settings.booking.minNoticeMinutes,
      maxDaysAhead: settings.booking.maxDaysAhead,
      timeOfDay,
      clinicHours: schedule.clinicHours,
      clinicClosures: schedule.clinicClosures,
      practitioners: candidates.map((p) => ({
        id: p.id,
        name: practitionerDisplayName(p),
        hours: schedule.hoursByPractitioner.get(p.id) ?? [],
        busy: schedule.busyByPractitioner.get(p.id) ?? [],
      })),
    });

  const slots = slotsFor(query.date, query.timeOfDay);
  const nextAvailableDates: LocalDate[] = [];
  if (slots.length === 0) {
    for (
      let i = 1;
      i <= NEXT_DATES_LOOKAHEAD_DAYS && nextAvailableDates.length < NEXT_DATES_COUNT;
      i++
    ) {
      const date = addLocalDays(query.date, i);
      if (slotsFor(date, query.timeOfDay).length > 0) nextAvailableDates.push(date);
    }
  }

  return { service: serviceSummary, slots, nextAvailableDates };
}

interface ScheduleWindow {
  clinicId: string;
  timeZone: string;
  practitionerIds: string[];
  fromDate: LocalDate;
  /** Inclusive. */
  toDate: LocalDate;
  excludeAppointmentId?: string;
}

async function loadSchedule(exec: Executor, window: ScheduleWindow) {
  const from = localToUtc(window.fromDate, 0, window.timeZone);
  const to = localToUtc(addLocalDays(window.toDate, 1), 0, window.timeZone);
  const ids = window.practitionerIds;

  const [hourRows, offRows, appointmentRows] = await Promise.all([
    exec
      .select({
        practitionerId: workingHours.practitionerId,
        weekday: workingHours.weekday,
        startTime: workingHours.startTime,
        endTime: workingHours.endTime,
      })
      .from(workingHours)
      .where(eq(workingHours.clinicId, window.clinicId)),
    exec
      .select({
        practitionerId: timeOff.practitionerId,
        startsAt: timeOff.startsAt,
        endsAt: timeOff.endsAt,
      })
      .from(timeOff)
      .where(
        and(
          eq(timeOff.clinicId, window.clinicId),
          lt(timeOff.startsAt, to),
          gt(timeOff.endsAt, from),
          or(isNull(timeOff.practitionerId), inArray(timeOff.practitionerId, ids)),
        ),
      ),
    exec
      .select({
        id: appointments.id,
        practitionerId: appointments.practitionerId,
        startsAt: appointments.startsAt,
        endsAt: appointments.endsAt,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.clinicId, window.clinicId),
          inArray(appointments.practitionerId, ids),
          inArray(appointments.status, [...ACTIVE_APPOINTMENT_STATUSES]),
          lt(appointments.startsAt, to),
          gt(appointments.endsAt, from),
        ),
      ),
  ]);

  const clinicHours: WeeklyRange[] = [];
  const hoursByPractitioner = new Map<string, WeeklyRange[]>();
  for (const row of hourRows) {
    const range = { weekday: row.weekday, startTime: row.startTime, endTime: row.endTime };
    if (row.practitionerId === null) clinicHours.push(range);
    else push(hoursByPractitioner, row.practitionerId, range);
  }

  const clinicClosures: Interval[] = [];
  const busyByPractitioner = new Map<string, Interval[]>();
  for (const row of offRows) {
    const interval = { start: row.startsAt.getTime(), end: row.endsAt.getTime() };
    if (row.practitionerId === null) clinicClosures.push(interval);
    else push(busyByPractitioner, row.practitionerId, interval);
  }
  for (const row of appointmentRows) {
    if (row.id === window.excludeAppointmentId) continue;
    push(busyByPractitioner, row.practitionerId, {
      start: row.startsAt.getTime(),
      end: row.endsAt.getTime(),
    });
  }

  return { clinicHours, clinicClosures, hoursByPractitioner, busyByPractitioner };
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}
