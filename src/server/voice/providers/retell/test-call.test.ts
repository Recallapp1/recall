import { describe, expect, it, vi } from "vitest";

import { isAppUrlReachable } from "./test-call";

describe("isAppUrlReachable", () => {
  it("probes the public health route", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    await expect(isAppUrlReachable("https://recall.example", fetchImpl)).resolves.toBe(true);
    expect(String((fetchImpl.mock.calls[0] as unknown[])[0])).toBe(
      "https://recall.example/api/health",
    );
  });

  it("is false for a dead tunnel (DNS failure)", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed: getaddrinfo ENOTFOUND");
    });
    await expect(isAppUrlReachable("https://gone.trycloudflare.com", fetchImpl)).resolves.toBe(
      false,
    );
  });

  it("is false when the app answers with an error", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 530 }));
    await expect(isAppUrlReachable("https://recall.example", fetchImpl)).resolves.toBe(false);
  });
});
