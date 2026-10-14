import { eq } from "drizzle-orm";
import { sign } from "retell-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import type { Database } from "../../../db";
import { calls } from "../../../db/schema";
import { handleCallEvent, type RetellHandlerDeps } from "./handlers";

/*
 * Per-call latency (AGENT-DESIGN.md "Ölçüm"): Retell reports end-to-end, ASR,
 * LLM and TTS latency on call_ended. Stored only with CALL_LATENCY_STORE on,
 * reduced to p50/p90/max (no per-turn values); an unexpected shape must
 * never break the event.
 */

const API_KEY = "key_test_0123456789";
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

const deps = (storeLatency?: boolean): RetellHandlerDeps => ({
  db,
  apiKey: API_KEY,
  now: () => new Date("2026-10-14T09:00:00Z"),
  defer: () => undefined,
  smsDelivers: false,
  dispatchClinic: async () => undefined,
  deleteProviderCall: async () => undefined,
  ...(storeLatency !== undefined && { storeLatency }),
});

async function ended(callId: string, latency: unknown, storeLatency?: boolean) {
  const raw = JSON.stringify({
    event: "call_ended",
    call: {
      call_id: callId,
      agent_id: clinic.agentId,
      duration_ms: 60_000,
      disconnection_reason: "user_hangup",
      latency,
    },
  });
  const response = await handleCallEvent(
    new Request("https://recall.test/api/voice/retell/events", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-retell-signature": await sign(raw, API_KEY),
      },
      body: raw,
    }),
    deps(storeLatency),
  );
  expect(response.status).toBe(200);
  const [row] = await db.select().from(calls).where(eq(calls.providerCallId, callId));
  return row!;
}

const reported = {
  e2e: { p50: 1210, p90: 1880, p95: 2000, max: 2410, min: 900, num: 7, values: [900, 1210] },
  llm: { p50: 640, p90: 990, max: 1300, num: 7, values: [600] },
  asr: { p50: 180, p90: 240, max: 260 },
  tts: { p50: 310, p90: 400, max: 450 },
  knowledge_base: { num: 0 },
};

describe("call latency", () => {
  it("is stored as p50/p90/max per component when CALL_LATENCY_STORE is on", async () => {
    const row = await ended("call_latency_on", reported, true);
    expect(row.latency).toEqual({
      e2e: { p50: 1210, p90: 1880, max: 2410 },
      llm: { p50: 640, p90: 990, max: 1300 },
      asr: { p50: 180, p90: 240, max: 260 },
      tts: { p50: 310, p90: 400, max: 450 },
    });
  });

  it("is not stored with the switch off (today's behaviour)", async () => {
    expect((await ended("call_latency_off", reported)).latency).toBeNull();
  });

  it("an unexpected shape stores nothing and the call is still recorded", async () => {
    const row = await ended("call_latency_odd", { e2e: "slow", llm: [1, 2] }, true);
    expect(row.latency).toBeNull();
    expect(row.durationSeconds).toBe(60);
    const row2 = await ended("call_latency_text", "n/a", true);
    expect(row2.durationSeconds).toBe(60);
  });
});
