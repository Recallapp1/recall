import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { cn, DESIGN_COLORS } from "./cn";

describe("cn", () => {
  it("keeps custom typography utilities alongside colours", () => {
    expect(cn("text-label", "text-on-dark")).toBe("text-label text-on-dark");
    expect(cn("text-display", "text-heading")).toBe("text-display text-heading");
  });

  it("lets later design-token colours and radii win", () => {
    expect(cn("bg-canvas", "bg-paper")).toBe("bg-paper");
    expect(cn("rounded-card", "rounded-section")).toBe("rounded-section");
  });

  it("knows every colour token defined in globals.css", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const tokens = [...css.matchAll(/--color-([a-z-]+):/g)].map((match) => match[1]);
    expect([...DESIGN_COLORS].sort()).toEqual([...new Set(tokens)].sort());
  });
});
