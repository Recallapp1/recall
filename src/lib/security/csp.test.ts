import { describe, expect, it } from "vitest";

import nextConfig from "../../../next.config";
import { contentSecurityPolicy } from "./csp";

describe("Content-Security-Policy", () => {
  const policy = contentSecurityPolicy();
  const directive = (name: string) =>
    policy
      .split("; ")
      .find((d) => d.startsWith(`${name} `))
      ?.slice(name.length + 1)
      .split(" ");

  it("blocks plugins, framing, foreign forms and base-tag hijacking", () => {
    expect(directive("object-src")).toEqual(["'none'"]);
    expect(directive("frame-ancestors")).toEqual(["'none'"]);
    expect(directive("form-action")).toEqual(["'self'"]);
    expect(directive("base-uri")).toEqual(["'self'"]);
    expect(policy).toContain("upgrade-insecure-requests");
  });

  it("loads scripts only from our origin and never evals in production", () => {
    expect(directive("script-src")).toEqual(["'self'", "'unsafe-inline'"]);
    expect(directive("default-src")).toEqual(["'self'"]);
  });

  it("allows the browser test call to reach Retell (verified with a real call)", () => {
    expect(directive("connect-src")).toEqual(
      expect.arrayContaining(["https://api.retellai.com", "wss://*.livekit.cloud"]),
    );
  });

  it("is sent on every route", async () => {
    const [rule] = await nextConfig.headers!();
    expect(rule.source).toBe("/:path*");
    expect(rule.headers.map((h) => h.key)).toContain("Content-Security-Policy");
  });
});
