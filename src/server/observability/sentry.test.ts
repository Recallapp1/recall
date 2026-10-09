import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";

import { scrubEvent } from "./sentry";

describe("Sentry scrubbing (KVKK)", () => {
  it("keeps only method and path of a request and drops people, crumbs and extras", () => {
    const event = scrubEvent({
      type: undefined,
      message: "boom",
      request: {
        method: "POST",
        url: "https://recalltr.company/panel/hastalar/123?ara=05320000025",
        data: { patientName: "Ayşe Yılmaz", phone: "+905320000025" },
        cookies: { session: "secret" },
        headers: { cookie: "session=secret", authorization: "Bearer x" },
        query_string: "ara=05320000025",
      },
      user: { email: "personel@klinik.test", ip_address: "1.2.3.4" },
      breadcrumbs: [{ message: "console: Ayşe Yılmaz" }],
      extra: { body: "Ayşe" },
      contexts: { request: { anything: true } as never },
    } as ErrorEvent);

    expect(event.request).toEqual({ method: "POST", url: "/panel/hastalar/123" });
    const text = JSON.stringify(event);
    for (const secret of ["Ayşe", "0532", "905320000025", "secret", "personel@", "1.2.3.4"]) {
      expect(text).not.toContain(secret);
    }
    expect(event.message).toBe("boom");
  });

  it("masks phones, e-mails and keys quoted in error messages", () => {
    const event = scrubEvent({
      type: undefined,
      message: "Hasta 0532 000 00 25 bulunamadı",
      exception: {
        values: [
          { type: "Error", value: "insert failed for sahip@klinik.test key_0123456789abcdef01" },
        ],
      },
    } as ErrorEvent);
    expect(event.message).toBe("Hasta [telefon] bulunamadı");
    expect(event.exception?.values?.[0]?.value).toBe("insert failed for [e-posta] [anahtar]");
  });
});
