import {
  diffLocalDays,
  isoWeekday,
  localToday,
  localToUtc,
  minutesToTime,
  timeToMinutes,
  type LocalDate,
  type LocalTime,
} from "./time";

/**
 * Pure availability engine. It never touches the database or the clock;
 * callers pass everything in, which keeps it exhaustively testable.
 */

export type TimeOfDay = "morning" | "afternoon" | "evening" | "any";

export interface WeeklyRange {
  weekday: number;
  startTime: string;
  endTime: string;
}

/** Half-open UTC interval in epoch milliseconds: [start, end). */
export interface Interval {
  start: number;
  end: number;
}

export interface PractitionerSchedule {
  id: string;
  name: string;
  /** Personal weekly hours. Empty means "follows clinic hours". */
  hours: WeeklyRange[];
  /** Existing appointments and personal time off. */
  busy: Interval[];
}

export interface AvailabilityInput {
  date: LocalDate;
  timeZone: string;
  now: Date;
  durationMinutes: number;
  slotIntervalMinutes: number;
  minNoticeMinutes: number;
  maxDaysAhead: number;
  timeOfDay?: TimeOfDay;
  /** Clinic-wide opening hours. Empty means "no clinic-level restriction". */
  clinicHours: WeeklyRange[];
  /** Clinic-wide closures such as public holidays. */
  clinicClosures: Interval[];
  practitioners: PractitionerSchedule[];
}

export interface Slot {
  time: LocalTime;
  startsAt: Date;
  endsAt: Date;
  practitionerId: string;
  practitionerName: string;
}

const MINUTE = 60_000;
const DAY_MINUTES = 24 * 60;

const TIME_OF_DAY_RANGES: Record<Exclude<TimeOfDay, "any">, [number, number]> = {
  morning: [0, 12 * 60],
  afternoon: [12 * 60, 17 * 60],
  evening: [17 * 60, DAY_MINUTES],
};

export function computeSlots(input: AvailabilityInput): Slot[] {
  const today = localToday(input.now, input.timeZone);
  const daysAhead = diffLocalDays(today, input.date);
  if (daysAhead < 0 || daysAhead > input.maxDaysAhead) return [];

  const weekday = isoWeekday(input.date);
  const clinicRanges = rangesFor(input.clinicHours, weekday);
  const clinicRestricted = input.clinicHours.length > 0;
  if (clinicRestricted && clinicRanges.length === 0) return [];

  const earliestStart = input.now.getTime() + input.minNoticeMinutes * MINUTE;
  const durationMs = input.durationMinutes * MINUTE;
  const [fromMinute, toMinute] =
    input.timeOfDay && input.timeOfDay !== "any"
      ? TIME_OF_DAY_RANGES[input.timeOfDay]
      : [0, DAY_MINUTES];

  const slots: Slot[] = [];

  for (const practitioner of input.practitioners) {
    let ranges: Array<[number, number]>;
    if (practitioner.hours.length === 0) {
      ranges = clinicRanges;
    } else {
      const own = rangesFor(practitioner.hours, weekday);
      ranges = clinicRestricted ? intersectRanges(own, clinicRanges) : own;
    }
    if (ranges.length === 0) continue;

    const open: Interval[] = ranges.map(([start, end]) => ({
      start: localToUtc(input.date, start, input.timeZone).getTime(),
      end: localToUtc(input.date, end, input.timeZone).getTime(),
    }));
    const free = subtractIntervals(open, [...input.clinicClosures, ...practitioner.busy]);

    for (let minute = 0; minute < DAY_MINUTES; minute += input.slotIntervalMinutes) {
      if (minute < fromMinute || minute >= toMinute) continue;

      const start = localToUtc(input.date, minute, input.timeZone).getTime();
      const end = start + durationMs;
      if (start < earliestStart) continue;
      if (!free.some((interval) => interval.start <= start && end <= interval.end)) continue;

      slots.push({
        time: minutesToTime(minute),
        startsAt: new Date(start),
        endsAt: new Date(end),
        practitionerId: practitioner.id,
        practitionerName: practitioner.name,
      });
    }
  }

  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/**
 * Reduces slots to at most `limit` distinct times spread across the day, so the
 * assistant can offer "morning or afternoon" style choices instead of 09:00, 09:15, 09:30.
 */
export function pickSpreadSlots(slots: Slot[], limit: number): Slot[] {
  const byTime = new Map<string, Slot>();
  for (const slot of slots) {
    if (!byTime.has(slot.time)) byTime.set(slot.time, slot);
  }
  const unique = [...byTime.values()];
  if (unique.length <= limit) return unique;
  if (limit <= 1) return unique.slice(0, limit);

  const step = (unique.length - 1) / (limit - 1);
  return Array.from({ length: limit }, (_, i) => unique[Math.round(i * step)]);
}

function rangesFor(hours: WeeklyRange[], weekday: number): Array<[number, number]> {
  return hours
    .filter((range) => range.weekday === weekday)
    .map(
      (range) => [timeToMinutes(range.startTime), timeToMinutes(range.endTime)] as [number, number],
    )
    .filter(([start, end]) => start < end)
    .sort((a, b) => a[0] - b[0]);
}

export function intersectRanges(
  a: Array<[number, number]>,
  b: Array<[number, number]>,
): Array<[number, number]> {
  const result: Array<[number, number]> = [];
  for (const [aStart, aEnd] of a) {
    for (const [bStart, bEnd] of b) {
      const start = Math.max(aStart, bStart);
      const end = Math.min(aEnd, bEnd);
      if (start < end) result.push([start, end]);
    }
  }
  return result.sort((x, y) => x[0] - y[0]);
}

export function subtractIntervals(base: Interval[], remove: Interval[]): Interval[] {
  let result = base.filter((interval) => interval.start < interval.end);
  for (const cut of remove) {
    const next: Interval[] = [];
    for (const interval of result) {
      if (cut.end <= interval.start || cut.start >= interval.end) {
        next.push(interval);
        continue;
      }
      if (cut.start > interval.start) next.push({ start: interval.start, end: cut.start });
      if (cut.end < interval.end) next.push({ start: cut.end, end: interval.end });
    }
    result = next;
  }
  return result;
}
