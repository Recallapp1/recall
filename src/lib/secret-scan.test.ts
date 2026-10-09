import { describe, expect, it } from "vitest";

import { mask, scanText, SECRET_KINDS } from "./secret-scan";

/* The secret scan behind `pnpm lint:secrets` and `pnpm review:package` (B5). */

const kinds = (text: string) => scanText("f.ts", text).map((f) => f.kind);

describe("scanText", () => {
  it("finds real-looking keys, tokens, private keys and credential URLs", () => {
    expect(kinds(`const k = "key_${"a1".repeat(14)}";`)).toEqual(["retell_key"]);
    expect(kinds(`RESEND=re_${"A".repeat(10)}_${"b".repeat(10)}`)).toContain("resend_key");
    expect(kinds(`token ghp_${"x".repeat(36)}`)).toEqual(["github_token"]);
    expect(kinds("-----BEGIN RSA PRIVATE KEY-----")).toEqual(["private_key"]);
    expect(kinds("DATABASE_URL=postgres://owner:s3cr3tpass@ep-abc.eu.neon.tech/db")).toContain(
      "credential_url",
    );
    expect(kinds("CRON_SECRET=Zq7xP0wLr2mK9vB4")).toEqual(["secret_assignment"]);
  });

  it("ignores placeholders, test values and schema code", () => {
    expect(kinds("DATABASE_URL=postgres://recall:recall@localhost:5433/recall")).toEqual([]);
    expect(kinds("  RETELL_API_KEY: optionalString,")).toEqual([]);
    expect(kinds('BETTER_AUTH_SECRET: "ci-only-secret-not-used-anywhere-0123456789"')).toEqual([]);
    expect(kinds("RETELL_API_KEY=key_xxxxxxxxxxxxxxxx")).toEqual([]);
  });

  it("reports phones and e-mails outside the test ranges, but not as secrets", () => {
    const found = scanText("f.ts", "arayan 0533 111 22 33, posta ali@gmail.com");
    expect(found.map((f) => f.kind)).toEqual(["phone", "email"]);
    expect(found.every((f) => !SECRET_KINDS.has(f.kind))).toBe(true);
    expect(kinds("test 0532 000 00 25 ve sahip@klinik.test")).toEqual([]);
  });

  it("never returns a value, only a masked sample", () => {
    const [finding] = scanText("f.ts", `key_${"ab".repeat(15)}`);
    expect(finding?.sample).toBe(mask(`key_${"ab".repeat(15)}`));
    expect(finding?.sample).not.toContain("abab");
  });
});
