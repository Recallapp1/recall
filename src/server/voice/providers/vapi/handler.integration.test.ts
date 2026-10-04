import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import type { Database } from "../../../db";
import { appointments, callbackRequests, calls } from "../../../db/schema";
import { handleVapiRequest, type VapiHandlerDeps } from "./handler";

const SECRET = "integration-secret-0123456789";
const NOW = new Date("2026-10-04T09:00:00Z"); // Sunday noon in Istanbul
const CALLER = "+905321234567";

let db: Database;
let close: () => Promise<void>;
let clinic: TestClinic;
let deferred: Array<() => Promise<void>>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  clinic = await createTestClinic(db, { phoneNumber: "+902129990000" });
});

afterAll(async () => {
  await close();
});

function deps(): VapiHandlerDeps {
  deferred = [];
  return {
    db,
    secret: SECRET,
    serverUrl: "https://recall.test/api/voice/vapi",
    pipeline: {
      llmModel: "claude-opus-5-5",
      transcriberProvider: "deepgram",
      transcriberModel: "nova-2",
      ttsProvider: "azure",
      ttsVoiceId: "tr-TR-EmelNeural",
    },
    now: () => NOW,
    defer: (task) => deferred.push(task),
  };
}

async function send(message: Record<string, unknown>, to = "+902129990000") {
  const response = await handleVapiRequest(
    new Request("https://recall.test/api/voice/vapi", {
      method: "POST",
      headers: { "content-type": "application/json", "x-vapi-secret": SECRET },
      body: JSON.stringify({
        message: {
          call: { id: "vapi-call-1" },
          phoneNumber: { number: to },
          customer: { number: CALLER },
          ...message,
        },
      }),
    }),
    deps(),
  );
  return { status: response.status, body: await response.json() };
}

async function callTool(name: string, args: Record<string, unknown>) {
  const { status, body } = await send({
    type: "tool-calls",
    toolCallList: [{ id: `tc-${name}`, type: "function", function: { name, arguments: args } }],
  });
  expect(status).toBe(200);
  expect(body.results[0].toolCallId).toBe(`tc-${name}`);
  return JSON.parse(body.results[0].result);
}

describe("Vapi webhook: full call", () => {
  it("serves a clinic-specific assistant and registers the call", async () => {
    const { status, body } = await send({ type: "assistant-request" });

    expect(status).toBe(200);
    expect(body.assistant.firstMessage).toContain(clinic.ctx.clinic.name);
    expect(body.assistant.model.messages[0].content).toContain(`(id: ${clinic.serviceId})`);

    const [call] = await db.select().from(calls).where(eq(calls.providerCallId, "vapi-call-1"));
    expect(call).toMatchObject({ clinicId: clinic.ctx.clinic.id, fromNumber: CALLER });
  });

  it("answers an unknown number with a spoken error", async () => {
    const { status, body } = await send({ type: "assistant-request" }, "+902120000999");
    expect(status).toBe(200);
    expect(body.error).toBeTypeOf("string");
  });

  it("checks availability, books, and records the outcome", async () => {
    const availability = await callTool("check_availability", {
      serviceId: clinic.serviceId,
      date: "2026-10-05",
    });
    expect(availability.ok).toBe(true);
    expect(availability.spokenDate).toBe("5 Ekim Pazartesi");
    const slot = availability.slots[0];
    expect(slot).toMatchObject({ time: "09:00", practitionerName: "Dt. Can Demir" });

    const booking = await callTool("book_appointment", {
      serviceId: clinic.serviceId,
      practitionerId: slot.practitionerId,
      date: "2026-10-05",
      time: slot.time,
      patientName: "Ayşe Yılmaz",
    });
    expect(booking).toMatchObject({
      ok: true,
      time: "09:00",
      alreadyExisted: false,
      smsSent: true,
    });
    expect(deferred).toHaveLength(1); // confirmation SMS runs after the response

    const [appointment] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, booking.appointmentId));
    expect(appointment.source).toBe("voice");
    expect(appointment.callId).not.toBeNull();
  });

  it("returns validation and business errors as speakable results", async () => {
    const invalid = await callTool("book_appointment", { serviceId: "not-a-uuid" });
    expect(invalid).toMatchObject({ ok: false, error: "INVALID_ARGUMENTS" });

    const unknown = await callTool("delete_everything", {});
    expect(unknown).toMatchObject({ ok: false, error: "UNKNOWN_TOOL" });
  });

  it("stores callback requests", async () => {
    const result = await callTool("create_callback_request", { reason: "Fatura hakkında soru" });
    expect(result.ok).toBe(true);
    const rows = await db
      .select()
      .from(callbackRequests)
      .where(eq(callbackRequests.clinicId, clinic.ctx.clinic.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].phone).toBe(CALLER);
  });

  it("completes the call without downgrading the booking outcome", async () => {
    const { status } = await send({
      type: "end-of-call-report",
      endedReason: "customer-ended-call",
      durationSeconds: 142,
      cost: 0.31,
      analysis: { summary: "Hasta muayene randevusu aldı." },
      artifact: {
        transcript: "AI: Merhaba\nUser: Randevu istiyorum",
        recordingUrl: "https://rec.test/1.wav",
      },
    });
    expect(status).toBe(200);

    const [call] = await db.select().from(calls).where(eq(calls.providerCallId, "vapi-call-1"));
    expect(call).toMatchObject({
      outcome: "booked",
      durationSeconds: 142,
      summary: "Hasta muayene randevusu aldı.",
      recordingUrl: "https://rec.test/1.wav",
      costUsd: "0.3100",
    });
  });
});
