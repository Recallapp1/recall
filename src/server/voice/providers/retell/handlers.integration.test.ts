import { eq } from "drizzle-orm";
import { sign } from "retell-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import type { Database } from "../../../db";
import { appointments, callbackRequests, calls, clinics } from "../../../db/schema";
import {
  handleCallEvent,
  handleFunctionCall,
  handleInbound,
  type RetellHandlerDeps,
} from "./handlers";

const API_KEY = "key_test_0123456789";
const NOW = new Date("2026-10-04T09:00:00Z"); // Sunday noon in Istanbul
const CALLER = "+905321234567";
const CALL_ID = "call_retell_1";

let db: Database;
let close: () => Promise<void>;
let clinic: TestClinic;
let other: TestClinic;
let deferred: Array<() => Promise<void>>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  clinic = await createTestClinic(db, {
    phoneNumber: "+902129990000",
    transferPhoneNumber: "+905550000000",
  });
  other = await createTestClinic(db, { phoneNumber: "+902129990001" });
});

afterAll(async () => {
  await close();
});

function deps(): RetellHandlerDeps {
  deferred = [];
  return { db, apiKey: API_KEY, now: () => NOW, defer: (task) => deferred.push(task) };
}

/** Builds a request signed exactly like Retell does (official SDK helper). */
async function signedRequest(body: unknown, key = API_KEY) {
  const raw = JSON.stringify(body);
  return new Request("https://recall.test/api/voice/retell", {
    method: "POST",
    headers: { "content-type": "application/json", "x-retell-signature": await sign(raw, key) },
    body: raw,
  });
}

const call = (overrides: Record<string, unknown> = {}) => ({
  call_id: CALL_ID,
  agent_id: clinic.agentId,
  call_type: "phone_call",
  from_number: CALLER,
  to_number: clinic.phoneNumber,
  metadata: { clinic_id: clinic.ctx.clinic.id },
  ...overrides,
});

async function tool(name: string, args: Record<string, unknown>, callOverrides = {}) {
  const response = await handleFunctionCall(
    await signedRequest({ name, args, call: call(callOverrides) }),
    deps(),
  );
  return { status: response.status, body: await response.json() };
}

describe("signature verification", () => {
  it("rejects unsigned, mis-signed and tampered requests", async () => {
    const unsigned = new Request("https://recall.test", { method: "POST", body: "{}" });
    expect((await handleInbound(unsigned, deps())).status).toBe(401);

    const wrongKey = await signedRequest({ event: "call_inbound" }, "another_key");
    expect((await handleInbound(wrongKey, deps())).status).toBe(401);

    const valid = await signedRequest({ name: "x", args: {}, call: call() });
    const tampered = new Request(valid.url, {
      method: "POST",
      headers: valid.headers,
      body: JSON.stringify({ name: "x", args: { evil: true }, call: call() }),
    });
    expect((await handleFunctionCall(tampered, deps())).status).toBe(401);
  });
});

describe("inbound webhook", () => {
  it("pins the call to the clinic's agent with call-time variables", async () => {
    const response = await handleInbound(
      await signedRequest({
        event: "call_inbound",
        call_inbound: { call_id: CALL_ID, from_number: CALLER, to_number: "0212 999 00 00" },
      }),
      deps(),
    );
    expect(await response.json()).toEqual({
      call_inbound: {
        override_agent_id: clinic.agentId,
        override_agent_version: 0,
        // Sunday: clinic closed, so no live transfer.
        dynamic_variables: { transfer_available: "hayır", clinic_status: "active" },
        metadata: { clinic_id: clinic.ctx.clinic.id },
      },
    });

    const [row] = await db.select().from(calls).where(eq(calls.providerCallId, CALL_ID));
    expect(row).toMatchObject({
      clinicId: clinic.ctx.clinic.id,
      provider: "retell",
      fromNumber: CALLER,
    });
  });

  it("rejects numbers that belong to no clinic", async () => {
    const response = await handleInbound(
      await signedRequest({ event: "call_inbound", call_inbound: { to_number: "+902120000999" } }),
      deps(),
    );
    expect(await response.json()).toEqual({ call_inbound: { reject: true } });
  });
});

describe("custom functions", () => {
  it("checks availability and books inside the agent's clinic", async () => {
    const availability = await tool("check_availability", {
      serviceId: clinic.serviceId,
      date: "2026-10-05",
    });
    expect(availability.status).toBe(200);
    expect(availability.body).toMatchObject({ ok: true, spokenDate: "beş Ekim Pazartesi" });
    const [slot] = availability.body.slots;

    const booking = await tool("book_appointment", {
      serviceId: clinic.serviceId,
      practitionerId: slot.practitionerId,
      date: "2026-10-05",
      time: slot.time,
      patientName: "Ayşe Yılmaz",
    });
    expect(booking.body).toMatchObject({ ok: true, alreadyExisted: false, smsSent: true });
    expect(deferred).toHaveLength(1);

    const [appointment] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, booking.body.appointmentId));
    expect(appointment).toMatchObject({ source: "voice", clinicId: clinic.ctx.clinic.id });
  });

  it("asks for a phone number on web calls without caller id", async () => {
    const result = await tool("find_appointments", {}, { from_number: null, call_id: "web_1" });
    expect(result.body).toMatchObject({ ok: false, error: "PHONE_REQUIRED" });
  });

  it("refuses a call whose stamped clinic disagrees with its agent", async () => {
    const result = await tool(
      "find_appointments",
      {},
      { call_id: "spoof_1", metadata: { clinic_id: other.ctx.clinic.id } },
    );
    expect(result.status).toBe(404);
  });

  it("cannot reach another clinic's data through tool arguments", async () => {
    const result = await tool("check_availability", {
      serviceId: other.serviceId,
      date: "2026-10-05",
    });
    expect(result.body).toMatchObject({ ok: false, error: "INVALID_SERVICE" });
  });

  it("blocks bookings while the clinic is paused, but still takes callbacks", async () => {
    await db.update(clinics).set({ status: "paused" }).where(eq(clinics.id, clinic.ctx.clinic.id));
    try {
      const booking = await tool("book_appointment", {
        serviceId: clinic.serviceId,
        practitionerId: clinic.practitionerId,
        date: "2026-10-05",
        time: "11:00",
        patientName: "Mehmet Kaya",
      });
      expect(booking.body).toMatchObject({ ok: false, error: "CLINIC_PAUSED" });

      const callback = await tool("create_callback_request", { reason: "Randevu almak istiyor" });
      expect(callback.body.ok).toBe(true);
      const rows = await db
        .select()
        .from(callbackRequests)
        .where(eq(callbackRequests.clinicId, clinic.ctx.clinic.id));
      expect(rows).toHaveLength(1);
    } finally {
      await db
        .update(clinics)
        .set({ status: "active" })
        .where(eq(clinics.id, clinic.ctx.clinic.id));
    }
  });
});

describe("call events", () => {
  it("records ended and analyzed events without losing earlier data or the booking", async () => {
    const ended = {
      ...call(),
      start_timestamp: Date.parse("2026-10-04T09:00:00Z"),
      end_timestamp: Date.parse("2026-10-04T09:02:22Z"),
      duration_ms: 142_000,
      disconnection_reason: "user_hangup",
      transcript: "Agent: Merhaba\nUser: Randevu istiyorum",
      recording_url: "https://rec.test/1.wav",
      call_cost: { combined_cost: 31 },
    };
    await handleCallEvent(await signedRequest({ event: "call_ended", call: ended }), deps());
    await handleCallEvent(
      await signedRequest({
        event: "call_analyzed",
        call: { ...call(), call_analysis: { call_summary: "Hasta muayene randevusu aldı." } },
      }),
      deps(),
    );
    // Retries must be harmless.
    await handleCallEvent(await signedRequest({ event: "call_ended", call: ended }), deps());

    const [row] = await db.select().from(calls).where(eq(calls.providerCallId, CALL_ID));
    expect(row).toMatchObject({
      outcome: "booked",
      durationSeconds: 142,
      endedReason: "user_hangup",
      transcript: "Agent: Merhaba\nUser: Randevu istiyorum",
      summary: "Hasta muayene randevusu aldı.",
      recordingUrl: "https://rec.test/1.wav",
      costUsd: "0.3100",
    });
  });

  it("acknowledges events for unknown agents without storing anything", async () => {
    const response = await handleCallEvent(
      await signedRequest({
        event: "call_ended",
        call: call({ agent_id: "agent_unknown", call_id: "x" }),
      }),
      deps(),
    );
    expect(response.status).toBe(200);
    expect(await db.select().from(calls).where(eq(calls.providerCallId, "x"))).toEqual([]);
  });
});
