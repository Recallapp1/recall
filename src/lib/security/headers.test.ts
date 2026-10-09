import { describe, expect, it } from "vitest";

import nextConfig from "../../../next.config";

/*
 * Security headers on every route (audit B3), checked on the live site on
 * 2026-10-09 and pinned here so a config edit cannot drop one silently.
 */
describe("security headers", () => {
  it("sends HSTS, nosniff, frame denial, referrer policy, permissions policy and CSP everywhere", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((rule) => rule.source === "/:path*");
    const headers = Object.fromEntries((all?.headers ?? []).map((h) => [h.key, h.value]));
    expect(headers["Strict-Transport-Security"]).toMatch(/max-age=\d{8,}; includeSubDomains/);
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
  });
});
