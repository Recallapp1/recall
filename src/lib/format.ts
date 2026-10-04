/**
 * Turkish display formats that work in client and server components alike.
 * Dates are clinic-local "YYYY-MM-DD" strings, so no time zone is involved.
 */

function toDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 12));
}

/** "5 Ekim 2026 Pazartesi" */
export function formatLongDate(date: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
    timeZone: "UTC",
  }).format(toDate(date));
}

/** "5 Eki Pzt" */
export function formatShortDate(date: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    weekday: "short",
    timeZone: "UTC",
  }).format(toDate(date));
}

/** "14:30" for minutes since midnight. */
export function formatMinutes(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

/** Relative time for feeds: "3 dk önce", "2 sa önce", "dün". */
export function formatRelative(instant: Date, now: Date): string {
  const minutes = Math.round((now.getTime() - instant.getTime()) / 60_000);
  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.round(hours / 24);
  return days === 1 ? "dün" : `${days} gün önce`;
}
