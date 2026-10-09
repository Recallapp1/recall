import { describe, expect, it } from "vitest";

import {
  budgetAllows,
  cautiousCallEstimate,
  isCreditExhausted,
} from "../../scripts/voice-eval/budget";
import { estimatedCost, profiles, STAGES } from "../../scripts/voice-eval/profiles";

describe("voice evaluation spending guard (C8)", () => {
  it("allows a call only while spent + next call stays within the budget", () => {
    expect(budgetAllows(0, 0.3, 10)).toBe(true);
    expect(budgetAllows(9.7, 0.3, 10)).toBe(true);
    expect(budgetAllows(9.71, 0.3, 10)).toBe(false);
    expect(budgetAllows(0, 0.3, 0)).toBe(false);
  });

  it("recognises Retell's out-of-credit answers and nothing else", () => {
    expect(isCreditExhausted({ status: 402, message: "Payment Required" })).toBe(true);
    expect(isCreditExhausted(new Error("Insufficient credit balance, please top up"))).toBe(true);
    expect(isCreditExhausted({ status: 500, message: "Internal error" })).toBe(false);
    expect(isCreditExhausted(new Error("timeout"))).toBe(false);
    expect(isCreditExhausted(null)).toBe(false);
    expect(isCreditExhausted("402")).toBe(false);
  });

  it("estimates a call cautiously", () => {
    expect(cautiousCallEstimate(0.2)).toBeCloseTo(0.3);
  });

  it("stage 1 is baseline + the cheapest fast model, and every staged profile exists", () => {
    expect(STAGES["1"]).toEqual(["baseline", "option-c-gemini"]);
    const ids = new Set(profiles.map((p) => p.id));
    const staged = Object.values(STAGES).flat();
    for (const id of staged) expect(ids.has(id), id).toBe(true);
    // Every profile is measured exactly once across the stages.
    expect(new Set(staged).size).toBe(staged.length);
    expect([...ids].sort()).toEqual([...staged].sort());
  });

  it("stage 1 costs less than measuring every profile at once", () => {
    const cost = (ids: string[]) =>
      ids.reduce(
        (sum, id) =>
          sum +
          estimatedCost(
            profiles.find((p) => p.id === id)!,
            26,
          ),
        0,
      );
    expect(cost(STAGES["1"]!)).toBeLessThan(cost(profiles.map((p) => p.id)) / 2);
  });
});
