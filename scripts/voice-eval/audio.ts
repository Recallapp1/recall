import type { Scenario } from "./scenarios";

/** Silence after each caller line: long enough for the assistant to answer. */
export const DEFAULT_TURN_GAP_MS = 13_000;

/** SSML silence of the given length, in breaks of at most 5 s (Windows TTS caps long breaks). */
export function gapMarkup(ms: number): string {
  const parts: number[] = [];
  for (let left = ms; left > 0; left -= 5_000) parts.push(Math.min(5_000, left));
  return parts.map((part) => `<break time="${part}ms"/>`).join("");
}

export function turnGap(scenario: Pick<Scenario, "turnGapMs">): string {
  return gapMarkup(scenario.turnGapMs ?? DEFAULT_TURN_GAP_MS);
}
