import { describe, expect, it } from "vitest";

import { acceptInvitationSchema, safeNextPath, setPasswordSchema, signInSchema } from "./auth";

describe("auth contracts", () => {
  it("normalises the sign-in email", () => {
    const parsed = signInSchema.parse({ email: "  Elif@Klinik.COM ", password: "x" });
    expect(parsed.email).toBe("elif@klinik.com");
  });

  it("requires matching passwords of at least 10 characters", () => {
    const short = setPasswordSchema.safeParse({
      token: "t",
      password: "kisa",
      passwordRepeat: "kisa",
    });
    expect(short.success).toBe(false);
    const mismatch = setPasswordSchema.safeParse({
      token: "t",
      password: "uzun-parola-1",
      passwordRepeat: "uzun-parola-2",
    });
    expect(mismatch.error?.issues[0]?.path).toEqual(["passwordRepeat"]);
  });

  it("validates the invitation form", () => {
    const parsed = acceptInvitationSchema.safeParse({
      invitationId: "6c1c7c1e-8d1f-4b5b-9a55-0d6f1f0b9f10",
      name: "Elif Kaya",
      password: "guclu-parola-42",
      passwordRepeat: "guclu-parola-42",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/panel/randevular")).toBe("/panel/randevular");
  });

  it("rejects targets a browser would turn into another host", () => {
    // Browsers drop tabs and line breaks in URLs and read "\" as "/".
    for (const sneaky of [
      "/\t/evil.com",
      "/\n/evil.com",
      "/\r/evil.com",
      "/ /evil.com",
      "/a\\..\\\\evil.com",
    ]) {
      expect(safeNextPath(sneaky)).toBe("/panel/baslangic");
    }
    expect(safeNextPath("/panel/takvim?gun=2026-10-08#x")).toBe("/panel/takvim?gun=2026-10-08#x");
  });

  it("rejects external and protocol-relative targets", () => {
    expect(safeNextPath("https://evil.example")).toBe("/panel/baslangic");
    expect(safeNextPath("//evil.example")).toBe("/panel/baslangic");
    expect(safeNextPath(String.raw`/\evil.example`)).toBe("/panel/baslangic");
    expect(safeNextPath(undefined)).toBe("/panel/baslangic");
  });
});
