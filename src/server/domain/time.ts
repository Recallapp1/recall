import { TZDate } from "@date-fns/tz";
import { addDays, format } from "date-fns";
import { tr } from "date-fns/locale";

/** A calendar date in the clinic's local time: "2026-11-05". */
export type LocalDate = string;
/** A wall-clock time in the clinic's local time: "14:30". */
export type LocalTime = string;

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_TIME = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

export function isLocalDate(value: string): boolean {
  const match = LOCAL_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isLocalTime(value: string): boolean {
  return LOCAL_TIME.test(value);
}

/** "09:30" or "09:30:00" → minutes since midnight. */
export function timeToMinutes(value: string): number {
  const match = LOCAL_TIME.exec(value);
  if (!match) throw new Error(`Invalid time: ${value}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export function minutesToTime(minutes: number): LocalTime {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** ISO weekday of a local date: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: LocalDate): number {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

/** The UTC instant of a clinic-local date and wall-clock minute. DST-safe. */
export function localToUtc(date: LocalDate, minutes: number, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const local = new TZDate(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, timeZone);
  return new Date(local.getTime());
}

export function utcToLocal(instant: Date, timeZone: string): { date: LocalDate; time: LocalTime } {
  const local = new TZDate(instant.getTime(), timeZone);
  return { date: format(local, "yyyy-MM-dd"), time: format(local, "HH:mm") };
}

export function localToday(now: Date, timeZone: string): LocalDate {
  return utcToLocal(now, timeZone).date;
}

export function addLocalDays(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = date.split("-").map(Number);
  return format(addDays(new Date(y, m - 1, d), days), "yyyy-MM-dd");
}

/** Whole days from `from` to `to` (both local dates). */
export function diffLocalDays(from: LocalDate, to: LocalDate): number {
  const toUtc = (value: LocalDate) => {
    const [y, m, d] = value.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

/** Written Turkish date for texts like SMS: "5 Kasım Perşembe". */
export function displayDate(date: LocalDate): string {
  const [y, m, d] = date.split("-").map(Number);
  return format(new Date(y, m - 1, d), "d MMMM EEEE", { locale: tr });
}

/** Long Turkish date with year: "4 Ekim 2026 Pazar". */
export function longDate(date: LocalDate): string {
  const [y, m, d] = date.split("-").map(Number);
  return format(new Date(y, m - 1, d), "d MMMM yyyy EEEE", { locale: tr });
}

export const WEEKDAY_NAMES_TR = [
  "",
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
  "Pazar",
] as const;
