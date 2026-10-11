import { eq } from "drizzle-orm";
import { sign } from "retell-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import type { Database } from "../../../db";
import { calls } from "../../../db/schema";
import { handleCallEvent, handleInbound, type RetellHandlerDeps } from "./handlers";

/*
 * Retell events arriving twice, late or out of order (R2 4a, 4n): one call
 * row, no lost transcript or summary, and the outcome never goes backwards.
 */

const API_KEY = "key_test_0123456789";
const NOW = new Date("2026-10-04T09:00:00Z");
const CALLER = "+905320000079";

let db: Database;
let close: () => Promise<void>;
let clinic: TestClinic;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  clinic = await createTestClinic(db, { phoneNumber: "+902129990079" });
});

afterAll(async () => {
  await close();
});

function deps(): RetellHandlerDeps {
  return {
    db,
    apiKey: API_KEY,
    now: () => NOW,
    defer: () => {},
    smsDelivers: false,
    dispatchClinic: async () => {},
    deleteProviderCall: async () => {},
  };
}

async function signed(body: unknown) {
  const raw = JSON.stringify(body);
  return new Request("https://recall.test/api/voice/retell", {
    method: "POST",
    headers: { "content-type": "application/json", "x-retell-signature": await sign(raw, API_KEY) },
    body: raw,
  });
}

function call(callId: string, extra: Record<string, unknown> = {}) {
  return {
    call_id: callId,
    agent_id: clinic.agentId,
    call_type: "phone_call",
    from_number: CALLER,
    to_number: clinic.phoneNumber,
    metadata: { clinic_id: clinic.ctx.clinic.id },
    ...extra,
  };
}

const ended = (callId: string) =>
  signed({
    event: "call_ended",
    call: call(callId, {
      start_timestamp: Date.parse("2026-10-04T08:50:00Z"),
      end_timestamp: Date.parse("2026-10-04T08:53:00Z"),
      duration_ms: 180_000,
      disconnection_reason: "user_hangup",
      transcript: "Agent: Merhaba\nUser: Bilgi almak istiyorum",
    }),
  });
const analyzed = (callId: string) =>
  signed({
    event: "call_analyzed",
    call: call(callId, { call_analysis: { call_summary: "Hasta bilgi aldı." } }),
  });
const started = (callId: string) =>
  signed({
    event: "call_started",
    call: call(callId, { start_timestamp: Date.parse("2026-10-04T08:50:00Z") }),
  });

async function rowsFor(callId: string) {
  return db.select().from(calls).where(eq(calls.providerCallId, callId));
}

describe("event order and duplicates (R2 4a)", () => {
  it("analysis before the end event: nothing is lost", async () => {
    const id = "call_order_1";
    await handleCallEvent(await analyzed(id), deps());
    await handleCallEvent(await ended(id), deps());
    const rows = await rowsFor(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      summary: "Hasta bilgi aldı.",
      transcript: "Agent: Merhaba\nUser: Bilgi almak istiyorum",
      durationSeconds: 180,
      outcome: "info",
    });
  });

  it("a late call_started after the end changes nothing", async () => {
    const id = "call_order_2";
    await handleCallEvent(await ended(id), deps());
    await handleCallEvent(await analyzed(id), deps());
    const [before] = await rowsFor(id);
    await handleCallEvent(await started(id), deps());
    const rows = await rowsFor(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      startedAt: before!.startedAt,
      endedAt: before!.endedAt,
      transcript: before!.transcript,
      summary: before!.summary,
      outcome: before!.outcome,
    });
  });

  it("the inbound webhook twice, then events: one call row", async () => {
    const id = "call_order_3";
    const inbound = () =>
      signed({
        event: "call_inbound",
        call_inbound: { call_id: id, from_number: CALLER, to_number: clinic.phoneNumber },
      });
    expect((await handleInbound(await inbound(), deps())).status).toBe(200);
    expect((await handleInbound(await inbound(), deps())).status).toBe(200);
    await handleCallEvent(await ended(id), deps());
    expect(await rowsFor(id)).toHaveLength(1);
  });

  it("a burst of 20 parallel duplicates (ended and analyzed): one row, final data intact", async () => {
    const id = "call_order_4";
    const requests = await Promise.all(
      Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? ended(id) : analyzed(id))),
    );
    const responses = await Promise.all(requests.map((r) => handleCallEvent(r, deps())));
    expect(responses.every((r) => r.status === 200)).toBe(true);
    const rows = await rowsFor(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ summary: "Hasta bilgi aldı.", durationSeconds: 180 });
  });
});
