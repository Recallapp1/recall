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
    fromNumber: "+905321234567",
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
});

afterAll(async () => {
  await close();
});

describe("applyRetention", () => {
  it("clears recordings after 30 days, transcripts after 90, numbers after 2 years", async () => {
    const result = await applyRetention(db, NOW);
    expect(result).toEqual({
      recordingsCleared: 3,
      transcriptsCleared: 2,
      callerNumbersCleared: 1,
    });

    expect(await row("fresh")).toMatchObject({
      recordingUrl: "https://rec.test/x.wav",
      transcript: "Agent: Merhaba",
      fromNumber: "+905321234567",
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
      recordingsCleared: 0,
      transcriptsCleared: 0,
      callerNumbersCleared: 0,
    });
  });
});
