import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import type { Database } from "../db";
import { calls, providerDeletions } from "../db/schema";
import { sweepRecordingOffCalls } from "./provider-deletions";

/*
 * RECORDING_OFF_SWEEP (full audit FA-10): with recording off, Retell's copy
 * is deleted when the call's analysis arrives. A call whose analysis never
 * arrives is queued by the daily job instead of waiting for Retell's 30 days.
 */

const NOW = new Date("2026-10-14T03:30:00Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 60 * 60 * 1000);

let db: Database;
let close: () => Promise<void>;
let off: TestClinic;
let on: TestClinic;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  off = await createTestClinic(db, { settings: { assistant: { recordCalls: false } } });
  on = await createTestClinic(db);
});

afterAll(async () => {
  await close();
});

async function call(clinic: TestClinic, id: string, startedAt: Date, recordingUrl?: string) {
  await db.insert(calls).values({
    clinicId: clinic.ctx.clinic.id,
    provider: "retell",
    providerCallId: id,
    startedAt,
    recordingUrl,
  });
}

async function queuedIds() {
  const rows = await db.select().from(providerDeletions);
  return rows.map((row) => row.providerCallId).sort();
}

describe("sweepRecordingOffCalls", () => {
  it("queues only unqueued calls of recording-off clinics between 2 hours and 30 days old", async () => {
    await call(off, "off_3h", hoursAgo(3));
    await call(off, "off_1h", hoursAgo(1));
    await call(off, "off_31d", hoursAgo(31 * 24));
    // Recorded before the clinic turned recording off: its recording was wanted.
    await call(off, "off_recorded", hoursAgo(5), "https://example.invalid/kept.wav");
    await call(on, "on_3h", hoursAgo(3));
    await call(off, "off_already", hoursAgo(4));
    await db.insert(providerDeletions).values({
      clinicId: off.ctx.clinic.id,
      provider: "retell",
      providerCallId: "off_already",
      reason: "recording_off",
      nextAttemptAt: NOW,
      doneAt: NOW,
    });

    expect(await sweepRecordingOffCalls(db, NOW)).toBe(1);
    expect(await queuedIds()).toEqual(["off_3h", "off_already"]);
    const [row] = await db
      .select()
      .from(providerDeletions)
      .where(eq(providerDeletions.providerCallId, "off_3h"));
    expect(row).toMatchObject({ reason: "recording_off", clinicId: off.ctx.clinic.id });

    // Idempotent: a second run queues nothing new.
    expect(await sweepRecordingOffCalls(db, NOW)).toBe(0);
  });
});
