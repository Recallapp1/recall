import { spokenDate } from "../../src/server/domain/speech";
import { addLocalDays } from "../../src/server/domain/time";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/**
 * Spoken dates from the run date (YYYY-MM-DD, clinic time): {tomorrow},
 * {nextMon} … {nextSun} for the first such weekday after today, and
 * {followingMon} … a week later ("haftaya Salı" may mean either).
 */
export function dateTokens(today: string): Record<string, string> {
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const tokens: Record<string, string> = { tomorrow: spokenDate(addLocalDays(today, 1)) };
  WEEKDAYS.forEach((name, day) => {
    const ahead = (day - weekday + 7) % 7 || 7;
    tokens[`next${name}`] = spokenDate(addLocalDays(today, ahead));
    tokens[`following${name}`] = spokenDate(addLocalDays(today, ahead + 7));
  });
  return tokens;
}

/**
 * "yirmi yedi Ekim Salı" → a pattern for "yirmi yedi Ekim" that does not
 * match inside a longer day ("on yedi Ekim" is not "yedi Ekim").
 */
export function dayMonthPattern(spoken: string): RegExp {
  const dayMonth = spoken.split(" ").slice(0, -1).join(" ");
  return new RegExp(String.raw`(?<!\p{L})(?<!(?:on|yirmi|otuz) )${dayMonth}`, "iu");
}
