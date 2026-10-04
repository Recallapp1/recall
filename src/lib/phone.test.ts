import { describe, expect, it } from "vitest";

import { maskName, maskPhone, normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it.each([
    ["0532 123 45 67", "+905321234567"],
    ["05321234567", "+905321234567"],
    ["532 123 45 67", "+905321234567"],
    ["+90 (532) 123-45-67", "+905321234567"],
    ["905321234567", "+905321234567"],
    ["00905321234567", "+905321234567"],
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
    expect(maskPhone("+905321234567")).toBe("+90532***4567");
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
