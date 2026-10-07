import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createTestClinic, createTestDb } from "@/test/db";

import type { Database } from "../db";
import * as schema from "../db/schema";
import { jobHealth } from "./job-runs";
import { runNotificationJob, type DispatchDeps } from "./notifications";

let db: Database;
let close: () => Promise<void>;
const NOW = new Date("2026-10-08T07:30:00Z");

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(async () => {
  await close();
});

const deps = (now = NOW): DispatchDeps => ({
  now,
  sendingEnabled: false,
  provider: { delivers: false, send: async () => {} },
  providerName: "test",
});

/** A clock that advances one "second" per reading: the budget runs out after N clinics. */
function tickingClock() {
  let t = 0;
  return () => (t += 1000);
}

describe("notification job runs", () => {
  it("stops at its budget, continues where it stopped, and does not repeat a finished day", async () => {
    for (let i = 0; i < 4; i += 1) await createTestClinic(db);

    const first = await runNotificationJob(db, deps(), undefined, {
      budgetMs: 2_500,
      clock: tickingClock(),
    });
    expect(first.status).toBe("partial");
    expect(first.clinics).toBeGreaterThan(0);
    expect(first.remaining).toBeGreaterThan(0);

    const second = await runNotificationJob(db, deps());
    expect(second).toMatchObject({ status: "succeeded", invocations: 2, remaining: 0 });
    // Together they covered every clinic exactly once.
    expect(first.clinics + second.clinics).toBe(4);

    const third = await runNotificationJob(db, deps());
    expect(third.status).toBe("skipped");

    const [run] = await db
      .select()
      .from(schema.jobRuns)
      .where(eq(schema.jobRuns.job, "notifications"));
    expect(run).toMatchObject({ status: "succeeded", invocations: 3 });
    expect(run!.finishedAt).not.toBeNull();
  });

  it("marks a day failed when a clinic fails, and retries only that clinic", async () => {
    const day = new Date("2026-10-09T07:30:00Z");
    const broken = await createTestClinic(db);
    await db
      .update(schema.clinics)
      .set({ timezone: "Invalid/Zone" })
      .where(eq(schema.clinics.id, broken.ctx.clinic.id));
    const log = vi.fn();

    const failed = await runNotificationJob(db, deps(day), log);
    expect(failed.status).toBe("failed");
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ clinicId: broken.ctx.clinic.id }));
    const [item] = await db
      .select()
      .from(schema.jobRunClinics)
      .where(eq(schema.jobRunClinics.clinicId, broken.ctx.clinic.id));
    expect(item).toMatchObject({ status: "failed" });
    expect(item!.errorCode).toBeTruthy();

    await db
      .update(schema.clinics)
      .set({ timezone: "Europe/Istanbul" })
      .where(eq(schema.clinics.id, broken.ctx.clinic.id));
    const retried = await runNotificationJob(db, deps(day));
    expect(retried).toMatchObject({ status: "succeeded", clinics: 1 });
  });
});

describe("job heartbeat", () => {
  it("reports a job that never ran, a recent success, an old one and a stuck run", async () => {
    const fresh = await createTestDb();
    try {
      const at = (iso: string) => new Date(iso);
      const health = (now: Date) => jobHealth(fresh.db, now);

      expect((await health(at("2026-10-10T08:00:00Z")))[0]).toMatchObject({
        job: "notifications",
        healthy: false,
        problem: "never_succeeded",
      });

      await fresh.db.insert(schema.jobRuns).values({
        job: "notifications",
        runOn: "2026-10-10",
        status: "succeeded",
        finishedAt: at("2026-10-10T07:40:00Z"),
      });
      expect((await health(at("2026-10-10T20:00:00Z")))[0]).toMatchObject({ healthy: true });
      // A day and a half later the daily run is overdue.
      expect((await health(at("2026-10-11T19:50:00Z")))[0]).toMatchObject({ problem: "too_old" });

      await fresh.db.insert(schema.jobRuns).values({
        job: "notifications",
        runOn: "2026-10-11",
        status: "running",
        heartbeatAt: at("2026-10-11T07:05:00Z"),
      });
      expect((await health(at("2026-10-11T07:30:00Z")))[0]).toMatchObject({ problem: "stuck" });
    } finally {
      await fresh.close();
    }
  });
});
