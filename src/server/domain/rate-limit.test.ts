import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDb } from "@/test/db";

import type { Database } from "../db";
import { consumeRateLimit, deleteExpiredRateLimits, hashKey, isRateLimited } from "./rate-limit";

let db: Database;
let close: () => Promise<void>;
const RULE = { limit: 2, windowMs: 60_000 };
const T0 = new Date("2026-10-07T10:00:00Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(async () => {
  await close();
});

describe("Postgres rate limiter", () => {
  it("allows up to the limit inside a window, then refuses", async () => {
    expect((await consumeRateLimit(db, "k1", RULE, T0)).allowed).toBe(true);
    expect((await consumeRateLimit(db, "k1", RULE, at(1_000))).allowed).toBe(true);
    expect(await isRateLimited(db, "k1", RULE, at(2_000))).toBe(true);
    expect((await consumeRateLimit(db, "k1", RULE, at(3_000))).allowed).toBe(false);
  });

  it("starts a fresh window once the old one has expired", async () => {
    const result = await consumeRateLimit(db, "k1", RULE, at(61_000));
    expect(result).toMatchObject({ allowed: true, count: 1 });
    expect(await isRateLimited(db, "k1", RULE, at(61_500))).toBe(false);
  });

  it("keeps keys independent and is safe under concurrent hits", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => consumeRateLimit(db, "k2", RULE, T0)),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(2);
    expect(await isRateLimited(db, "k3", RULE, T0)).toBe(false);
  });

  it("hashes personal data out of keys and deletes expired windows", async () => {
    const key = hashKey("clinic", "+905320000023");
    expect(key).not.toContain("905320000023");
    expect(key).toHaveLength(32);
    await consumeRateLimit(db, key, RULE, T0);
    expect(await deleteExpiredRateLimits(db, at(10 * 60_000))).toBeGreaterThan(0);
    expect(await isRateLimited(db, key, { limit: 1, windowMs: 60_000 }, at(10 * 60_000))).toBe(
      false,
    );
  });
});
