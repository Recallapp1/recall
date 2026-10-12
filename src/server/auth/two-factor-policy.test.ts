import { describe, expect, it } from "vitest";

import { mayResetTwoFactor, mustUseTwoFactor } from "./two-factor";

/* Two-step sign-in policy (owner's decision 2026-10-12). */

describe("mustUseTwoFactor", () => {
  const owner = { memberRole: "owner" };
  const admin = { memberRole: "admin" };
  const staff = { memberRole: "staff" };
  const both = { memberRole: "staff,admin" };
  const recall = { platformRole: "platform_admin" };

  it("off and optional never require it", () => {
    for (const policy of ["off", "optional"] as const) {
      for (const who of [owner, admin, staff, recall]) {
        expect(mustUseTwoFactor(policy, who)).toBe(false);
      }
    }
  });

  it("required-admins: owners, admins and Recall platform admins only", () => {
    expect(mustUseTwoFactor("required-admins", owner)).toBe(true);
    expect(mustUseTwoFactor("required-admins", admin)).toBe(true);
    expect(mustUseTwoFactor("required-admins", both)).toBe(true);
    expect(mustUseTwoFactor("required-admins", recall)).toBe(true);
    expect(mustUseTwoFactor("required-admins", staff)).toBe(false);
    expect(mustUseTwoFactor("required-admins", { memberRole: "practitioner" })).toBe(false);
  });

  it("required-all: everyone", () => {
    for (const who of [owner, admin, staff, recall, { memberRole: "practitioner" }]) {
      expect(mustUseTwoFactor("required-all", who)).toBe(true);
    }
  });
});

describe("mayResetTwoFactor", () => {
  it("only the configured Recall owner e-mail(s); unset means nobody", () => {
    expect(mayResetTwoFactor("sahip@recall.test", undefined)).toBe(false);
    expect(mayResetTwoFactor("sahip@recall.test", "")).toBe(false);
    expect(mayResetTwoFactor("Sahip@Recall.test", " sahip@recall.test ")).toBe(true);
    expect(mayResetTwoFactor("baska@recall.test", "sahip@recall.test")).toBe(false);
  });
});
