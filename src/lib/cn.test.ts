import { describe, expect, it } from "vitest";

import { cn } from "./cn";

describe("cn", () => {
  it("keeps custom typography utilities alongside colours", () => {
    expect(cn("text-label", "text-on-dark")).toBe("text-label text-on-dark");
    expect(cn("text-display", "text-heading")).toBe("text-display text-heading");
  });

  it("lets later design-token colours and radii win", () => {
    expect(cn("bg-canvas", "bg-paper")).toBe("bg-paper");
    expect(cn("rounded-card", "rounded-section")).toBe("rounded-section");
  });
});
