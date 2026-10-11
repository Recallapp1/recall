import { eq } from "drizzle-orm";
import { sign } from "retell-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import type { Database } from "../../../db";
import { callPatients, calls, patients, providerDeletions } from "../../../db/schema";
import { anonymizePatient } from "../../../domain/panel";
import { handleCallEvent, type RetellHandlerDeps } from "./handlers";

/*
 * Gap review G-01: a call_ended / call_analyzed that arrives after a KVKK
 * erasure (a Retell retry, a late analysis, a replay) must not write the
 * transcript, summary or recording back, and post-call flags must not run.
 */

const API_KEY = "key_test_0123456789";
const NOW = new Date("2026-10-04T09:00:00Z");
const CALLER = "+905320000077";

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
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
    postCallFlags: true,
    dispatchClinic: async () => {},
    deleteProviderCall: async () => {},
  };
}

async function signedRequest(body: unknown) {
  const raw = JSON.stringify(body);
  return new Request("https://recall.test/api/voice/retell", {
    method: "POST",
    headers: { "content-type": "application/json", "x-retell-signature": await sign(raw, API_KEY) },
    body: raw,
  });
}

function event(clinic: TestClinic, callId: string, name: "call_ended" | "call_analyzed") {
  return signedRequest({
    event: name,
    call: {
      call_id: callId,
      agent_id: clinic.agentId,
      call_type: "phone_call",
      from_number: CALLER,
      to_number: clinic.phoneNumber,
      metadata: { clinic_id: clinic.ctx.clinic.id },
      start_timestamp: Date.parse("2026-10-04T08:50:00Z"),
      end_timestamp: Date.parse("2026-10-04T08:52:00Z"),
      duration_ms: 120_000,
      transcript: "Agent: Merhaba\nUser: Acil, nefes alamıyorum",
      recording_url: "https://rec.test/late.wav",
      call_analysis: { call_summary: "Hasta acil durum bildirdi." },
    },
  });
}

async function setup(settings?: { assistant: { recordCalls: boolean } }) {
  const clinic = await createTestClinic(db, settings ? { settings } : {});
  const [patient] = await db
    .insert(patients)
    .values({ clinicId: clinic.ctx.clinic.id, fullName: "Silinecek Kişi", phone: CALLER })
    .returning();
  const providerCallId = `call_late_${Math.random()}`;
  const [row] = await db
    .insert(calls)
    .values({
      clinicId: clinic.ctx.clinic.id,
      provider: "retell",
      providerCallId,
      fromNumber: CALLER,
    })
    .returning();
  await db
    .insert(callPatients)
    .values({ clinicId: clinic.ctx.clinic.id, callId: row!.id, patientId: patient!.id });
  return { clinic, patientId: patient!.id, callId: row!.id, providerCallId };
}

async function callRow(id: string) {
  const [row] = await db.select().from(calls).where(eq(calls.id, id));
  return row!;
}

describe("events after a KVKK erasure (G-01)", () => {
  it("a late call_ended and call_analyzed write nothing back and run no flags", async () => {
    const { clinic, patientId, callId, providerCallId } = await setup();
    await handleCallEvent(await event(clinic, providerCallId, "call_ended"), deps());
    expect((await callRow(callId)).transcript).not.toBeNull();

    await anonymizePatient(db, clinic.ctx.clinic.id, patientId, NOW);
    for (const name of ["call_ended", "call_analyzed", "call_analyzed"] as const) {
      const response = await handleCallEvent(await event(clinic, providerCallId, name), deps());
      expect(response.status).toBe(200);
    }
    expect(await callRow(callId)).toMatchObject({
      fromNumber: null,
      transcript: null,
      summary: null,
      recordingUrl: null,
      flags: null,
      flaggedAt: null,
    });
  });

  it("a call already queued because recording is off is upgraded to an erasure", async () => {
    const { clinic, patientId, callId, providerCallId } = await setup({
      assistant: { recordCalls: false },
    });
    // Recording off: the analysis queues the provider deletion ("recording_off").
    await handleCallEvent(await event(clinic, providerCallId, "call_analyzed"), deps());
    const [queued] = await db
      .select()
      .from(providerDeletions)
      .where(eq(providerDeletions.providerCallId, providerCallId));
    expect(queued?.reason).toBe("recording_off");

    await anonymizePatient(db, clinic.ctx.clinic.id, patientId, NOW);
    const rows = await db
      .select()
      .from(providerDeletions)
      .where(eq(providerDeletions.providerCallId, providerCallId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.reason).toBe("patient_anonymized");

    await handleCallEvent(await event(clinic, providerCallId, "call_analyzed"), deps());
    expect(await callRow(callId)).toMatchObject({ transcript: null, summary: null });
  });

  it("other calls still receive their events (no over-blocking)", async () => {
    const { clinic, callId, providerCallId } = await setup();
    await handleCallEvent(await event(clinic, providerCallId, "call_analyzed"), deps());
    expect(await callRow(callId)).toMatchObject({ summary: "Hasta acil durum bildirdi." });
  });
});
