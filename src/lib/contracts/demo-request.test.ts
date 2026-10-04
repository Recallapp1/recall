import { describe, expect, it } from "vitest";

import { demoRequestSchema } from "./demo-request";

const valid = {
  fullName: "Test Kullanıcı",
  clinicName: "Test Kliniği",
  phone: "0532 000 00 00",
  email: "",
  clinicType: "Diş kliniği",
  message: "",
  consent: "on",
};

describe("demoRequestSchema", () => {
  it("accepts a complete request and drops empty optionals", () => {
    const parsed = demoRequestSchema.parse(valid);
    expect(parsed.email).toBeUndefined();
    expect(parsed.message).toBeUndefined();
  });

  it("requires KVKK consent", () => {
    const result = demoRequestSchema.safeParse({ ...valid, consent: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["consent"]);
  });

  it("rejects invalid phone numbers, emails and clinic types", () => {
    for (const patch of [{ phone: "abc" }, { email: "x@" }, { clinicType: "Bilinmeyen" }]) {
      expect(demoRequestSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
    }
  });

  it("trims names", () => {
    expect(demoRequestSchema.parse({ ...valid, fullName: "  Ayşe Yılmaz  " }).fullName).toBe(
      "Ayşe Yılmaz",
    );
  });
});
