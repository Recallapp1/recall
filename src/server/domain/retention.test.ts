import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import { applyRetention } from "./retention";

let db: Database;
let close: () => Promise<void>;
let clinic: TestClinic;

const NOW = new Date("2026-10-05T07:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

async function insertCall(id: string, startedAt: Date) {
  await db.insert(schema.calls).values({
    clinicId: clinic.ctx.clinic.id,
    provider: "retell",
    providerCallId: id,
    fromNumber: "+905320000025",
    startedAt,
    transcript: "Agent: Merhaba",
    summary: "Bilgi aldı.",
    recordingUrl: "https://rec.test/x.wav",
  });
}

async function row(id: string) {
  const [call] = await db.select().from(schema.calls).where(eq(schema.calls.providerCallId, id));
  return call;
}

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  clinic = await createTestClinic(db);
  await insertCall("fresh", daysAgo(5));
  await insertCall("month", daysAgo(31));
  await insertCall("quarter", daysAgo(91));
  await insertCall("old", daysAgo(731));
  for (const [key, age] of [
    ["recent", 300],
    ["expired", 366],
  ] as const) {
    await db.insert(schema.notifications).values({
      clinicId: clinic.ctx.clinic.id,
      kind: "appointment_reminder",
      subjectId: clinic.ctx.clinic.id,
      dedupeKey: key,
      templateKey: "appointment_reminder.v1",
      status: "skipped",
      skipReason: "sending_disabled",
      scheduledFor: daysAgo(age),
      createdAt: daysAgo(age),
    });
  }
});

afterAll(async () => {
  await close();
});

describe("applyRetention", () => {
  it("clears recordings after 30 days, transcripts after 90, numbers after 2 years", async () => {
    const result = await applyRetention(db, NOW);
    expect(result).toEqual({
      followUpsDeleted: 0,
      rateLimitsDeleted: 0,
      callbacksDeleted: 0,
      jobRunsDeleted: 0,
      notificationsDeleted: 1,
      recordingsCleared: 3,
      transcriptsCleared: 2,
      callerNumbersCleared: 1,
    });
    // The notification log keeps a year (pending legal review).
    const left = await db.select().from(schema.notifications);
    expect(left.map((n) => n.dedupeKey)).toEqual(["recent"]);

    expect(await row("fresh")).toMatchObject({
      recordingUrl: "https://rec.test/x.wav",
      transcript: "Agent: Merhaba",
      fromNumber: "+905320000025",
    });
    expect(await row("month")).toMatchObject({
      recordingUrl: null,
      transcript: "Agent: Merhaba",
    });
    expect(await row("quarter")).toMatchObject({ recordingUrl: null, transcript: null });
    // The summary and the call itself stay for the clinic's statistics.
    expect(await row("old")).toMatchObject({
      fromNumber: null,
      transcript: null,
      summary: "Bilgi aldı.",
    });
  });

  it("is idempotent", async () => {
    expect(await applyRetention(db, NOW)).toEqual({
      followUpsDeleted: 0,
      rateLimitsDeleted: 0,
      callbacksDeleted: 0,
      jobRunsDeleted: 0,
      notificationsDeleted: 0,
      recordingsCleared: 0,
      transcriptsCleared: 0,
      callerNumbersCleared: 0,
    });
  });
});
