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
});
