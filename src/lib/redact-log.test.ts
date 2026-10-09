import { describe, expect, it } from "vitest";

import { redact } from "../../scripts/redact-log.mjs";

describe("redact (CI annotations, B2)", () => {
  it("removes phone numbers in every Turkish spelling", () => {
    for (const phone of ["+905320000025", "0532 000 00 25", "0 (532) 000-00-25", "5320000025"]) {
      expect(redact(`arayan ${phone} geldi`), phone).toBe("arayan [telefon] geldi");
    }
  });

  it("removes e-mail addresses, keys, connection strings and auth headers", () => {
    expect(redact("davet sahip@klinik.test gitti")).toBe("davet [e-posta] gitti");
    expect(redact("key_0123456789abcdef0123")).toBe("[anahtar]");
    expect(redact("postgres://u:p@host:5432/db sonra")).toBe("[bağlantı] sonra");
    expect(redact("Authorization: Bearer abc.def-ghi_jkl")).toBe("Authorization: [yetki]");
  });

  it("leaves ordinary log lines alone", () => {
    const line = "✓ panel.spec.ts:42 › randevu oluşturur (1.2s) 26 passed";
    expect(redact(line)).toBe(line);
  });
});

describe("redaction rules stay identical in CI and Sentry", () => {
  it("masks the same samples the same way", async () => {
    const { redact: forSentry } = await import("./redact");
    for (const sample of [
      "arayan +905320000025 ve 0 (532) 000-00-25",
      "posta sahip@klinik.test",
      "key_0123456789abcdef01 postgres://u:p@h/db Bearer abcdefgh123",
      "sıradan satır 26 passed",
    ]) {
      expect(forSentry(sample), sample).toBe(redact(sample));
    }
  });
});
