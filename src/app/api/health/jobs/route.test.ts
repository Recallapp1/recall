import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/server/db";
import { createTestDb } from "@/test/db";

let testDb: Database;
vi.mock("@/server/db", () => ({ db: () => testDb }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

let close: () => Promise<void>;

beforeAll(async () => {
  vi.stubEnv("APP_URL", "http://localhost:3000");
  vi.stubEnv("DATABASE_URL", "postgres://unused@localhost/unused");
  ({ db: testDb, close } = await createTestDb());
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await close();
});

beforeEach(() => {
  vi.resetModules();
});

async function get(headers: Record<string, string> = {}) {
  const { GET } = await import("./route");
  const response = await GET(new Request("http://localhost/api/health/jobs", { headers }));
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

describe("/api/health/jobs (A6)", () => {
  it("answers in full when HEALTH_JOBS_TOKEN is unset (unchanged behaviour)", async () => {
    vi.stubEnv("HEALTH_JOBS_TOKEN", "");
    const { body } = await get();
    expect(body).toHaveProperty("jobs");
  });

  it("gives anonymous callers only the status when a token is set", async () => {
    vi.stubEnv("HEALTH_JOBS_TOKEN", "uptime-token-for-tests");
    const anonymous = await get();
    expect(Object.keys(anonymous.body)).toEqual(["status"]);
    const wrong = await get({ "x-health-token": "nope" });
    expect(Object.keys(wrong.body)).toEqual(["status"]);
    const monitor = await get({ "x-health-token": "uptime-token-for-tests" });
    expect(monitor.body).toHaveProperty("jobs");
    // Same HTTP code either way: monitors work without the token too.
    expect(anonymous.status).toBe(monitor.status);
  });
});
