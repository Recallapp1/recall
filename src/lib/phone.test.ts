import { describe, expect, it } from "vitest";

import { maskName, maskPhone, normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it.each([
    ["0532 000 00 25", "+905320000025"],
    ["05320000025", "+905320000025"],
    ["532 000 00 25", "+905320000025"],
    ["+90 (532) 000-00-25", "+905320000025"],
    ["905320000025", "+905320000025"],
    ["00905320000025", "+905320000025"],
    ["0212 555 00 11", "+902125550011"],
    ["+1 415 555 0100", "+14155550100"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([null, undefined, "", "abc", "12345", "+123"])("rejects %s", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe("maskPhone", () => {
  it("keeps prefix and last four digits", () => {
    expect(maskPhone("+905320000025")).toBe("+90532***0025");
  });

  it("handles missing numbers", () => {
    expect(maskPhone(null)).toBe("gizli");
  });
});

describe("maskName", () => {
  it("keeps only initials", () => {
    expect(maskName("ayşe  yılmaz")).toBe("A*** Y***");
    expect(maskName("İsmail")).toBe("İ***");
  });
});
