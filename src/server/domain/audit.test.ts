import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import type { Database, Executor } from "../db";
import { auditEvents, clinics } from "../db/schema";
import { AuditWriteError, recordAudit, withAudit } from "./audit";
import { parseClinicSettings } from "./clinic-settings";
import { setClinicFeature } from "./settings";

let db: Database;
let close: () => Promise<void>;
let clinic: TestClinic;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  clinic = await createTestClinic(db);
});
afterAll(async () => {
  await close();
});

/** An executor whose writes always fail, like a database that is down. */
const brokenDb = {
  transaction: async () => {
    throw new Error("connection refused");
  },
} as unknown as Executor;

describe("audit records", () => {
  it("never lets an ordinary audit failure break the user's action", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      recordAudit(brokenDb, {
        clinicId: clinic.ctx.clinic.id,
        actorUserId: null,
        action: "settings.updated",
      }),
    ).resolves.toBeUndefined();
    log.mockRestore();
  });

  it("retries a critical record, then raises an alarm and fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      recordAudit(brokenDb, {
        clinicId: clinic.ctx.clinic.id,
        actorUserId: null,
        action: "patient.exported",
      }),
    ).rejects.toBeInstanceOf(AuditWriteError);
    const alarms = log.mock.calls.map(([line]) => String(line)).filter((l) => l.includes("ALARM"));
    expect(alarms).toHaveLength(1);
    expect(alarms[0]).toContain("audit.critical_write_failed");
    expect(alarms[0]).toContain("patient.exported");
    log.mockRestore();
  });

  it("rolls the change back when its critical audit record cannot be written", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    // A clinic id that does not exist: the audit insert violates its foreign key.
    const orphanAudit = {
      clinicId: "00000000-0000-4000-8000-000000000000",
      actorUserId: null,
      action: "platform.feature_changed" as const,
    };
    await expect(
      withAudit(db, orphanAudit, (tx) =>
        setClinicFeature(tx, clinic.ctx.clinic.id, "followUp", true),
      ),
    ).rejects.toBeInstanceOf(AuditWriteError);
    const [row] = await db.select().from(clinics).where(eq(clinics.id, clinic.ctx.clinic.id));
    expect(parseClinicSettings(row.settings).features.followUp).toBe(false);
    log.mockRestore();
  });

  it("commits the change and its record together", async () => {
    await withAudit(
      db,
      {
        clinicId: clinic.ctx.clinic.id,
        actorUserId: null,
        action: "platform.feature_changed",
        metadata: { feature: "followUp", enabled: true },
      },
      (tx) => setClinicFeature(tx, clinic.ctx.clinic.id, "followUp", true),
    );
    const [row] = await db.select().from(clinics).where(eq(clinics.id, clinic.ctx.clinic.id));
    expect(parseClinicSettings(row.settings).features.followUp).toBe(true);
    const records = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.clinicId, clinic.ctx.clinic.id));
    expect(records.map((r) => r.action)).toContain("platform.feature_changed");
  });
});
