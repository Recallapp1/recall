import { describe, expect, it } from "vitest";

import { DEFAULT_TURN_GAP_MS, gapMarkup, turnGap } from "../../scripts/voice-eval/audio";
import { scenarios } from "../../scripts/voice-eval/scenarios";

/*
 * Caller audio: each scripted line is followed by silence. 13 s by default,
 * long enough for the assistant to answer. The "caller keeps talking" check
 * needs the next line to come while the assistant is still on its emergency
 * turn; after 13 s of silence the rule ("end the call once the caller is
 * quiet") makes hanging up the right behaviour, and the check would fail it.
 */

describe("caller audio gaps", () => {
  it("default gap is today's 5 s + 5 s + 3 s, as SSML breaks of at most 5 s", () => {
    expect(DEFAULT_TURN_GAP_MS).toBe(13_000);
    expect(gapMarkup(13_000)).toBe(
      '<break time="5000ms"/><break time="5000ms"/><break time="3000ms"/>',
    );
    expect(gapMarkup(4_000)).toBe('<break time="4000ms"/>');
  });

  it("only the caller-keeps-talking scenario uses a short gap", () => {
    const short = scenarios.filter((s) => s.turnGapMs !== undefined);
    expect(short.map((s) => s.id)).toEqual(["c5-close-caller-continues"]);
    expect(short[0]!.turnGapMs).toBeLessThanOrEqual(5_000);
    for (const scenario of scenarios) {
      expect(turnGap(scenario)).toBe(gapMarkup(scenario.turnGapMs ?? DEFAULT_TURN_GAP_MS));
    }
  });
});
