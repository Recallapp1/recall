import { eq } from "drizzle-orm";
import { sign } from "retell-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import type { Database } from "../../../db";
import { appointments, calls, patients } from "../../../db/schema";
import { handleFunctionCall, type RetellHandlerDeps } from "./handlers";

/*
 * R2 4n: many calls at once through the real webhook handler. Every caller
 * gets their own booking, nothing is duplicated, and parallel retries of one
 * request book once (with VOICE_TOOL_IDEMPOTENCY and by the natural key).
 */

const API_KEY = "key_test_0123456789";
const NOW = new Date("2026-10-04T09:00:00Z"); // Sunday; Monday 2026-10-05 is open

let db: Database;
let close: () => Promise<void>;
let clinic: TestClinic;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  clinic = await createTestClinic(db, {
    phoneNumber: "+902129990095",
    settings: {
      booking: { minNoticeMinutes: 0, slotIntervalMinutes: 30 },
      limits: { callsPerHour: 1000, callsPerNumberPerHour: 100, callsPerNumberPerDay: 500 },
    },
  });
});

afterAll(async () => {
  await close();
});

function deps(toolIdempotency = false): RetellHandlerDeps {
  return {
    db,
    apiKey: API_KEY,
    now: () => NOW,
    defer: () => {},
    smsDelivers: false,
    toolIdempotency,
    dispatchClinic: async () => {},
    deleteProviderCall: async () => {},
  };
}

async function booking(callId: string, caller: string, time: string, name: string) {
  const raw = JSON.stringify({
    name: "book_appointment",
    args: {
      serviceId: clinic.serviceId,
      practitionerId: clinic.practitionerId,
      date: "2026-10-05",
      time,
      patientName: name,
    },
    call: {
      call_id: callId,
      agent_id: clinic.agentId,
      call_type: "phone_call",
      from_number: caller,
      to_number: clinic.phoneNumber,
      metadata: { clinic_id: clinic.ctx.clinic.id },
    },
  });
  return new Request("https://recall.test/api/voice/retell/tools", {
    method: "POST",
    headers: { "content-type": "application/json", "x-retell-signature": await sign(raw, API_KEY) },
    body: raw,
  });
}

describe("load (R2 4n)", () => {
  it("14 simultaneous calls book 14 different slots: 14 calls, 14 patients, 14 appointments", async () => {
    const times = Array.from({ length: 14 }, (_, i) => {
      const minute = 9 * 60 + i * 30;
      return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${minute % 60 === 0 ? "00" : "30"}`;
    });
    const requests = await Promise.all(
      times.map((time, i) =>
        booking(`load_${i}`, `+9053200002${String(i).padStart(2, "0")}`, time, `Yük Hasta ${i}`),
      ),
    );
    const responses = await Promise.all(requests.map((r) => handleFunctionCall(r, deps())));
    const bodies = await Promise.all(responses.map((r) => r.json()));
    expect(bodies.filter((b) => b.ok === true)).toHaveLength(14);

    const clinicId = clinic.ctx.clinic.id;
    expect(await db.select().from(calls).where(eq(calls.clinicId, clinicId))).toHaveLength(14);
    expect(await db.select().from(patients).where(eq(patients.clinicId, clinicId))).toHaveLength(
      14,
    );
    expect(
      await db.select().from(appointments).where(eq(appointments.clinicId, clinicId)),
    ).toHaveLength(14);
  }, 120_000);

  it("10 parallel retries of one booking book it once (idempotency on and off)", async () => {
    for (const [index, idempotent] of [true, false].entries()) {
      const callId = `retry_${index}`;
      const caller = `+90532000031${index}`;
      const requests = await Promise.all(
        Array.from({ length: 10 }, () =>
          booking(callId, caller, index === 0 ? "16:00" : "16:30", "Tekrar Hasta"),
        ),
      );
      // Byte-identical retries: the replay guard and the natural key both apply.
      await Promise.all(requests.map((r) => handleFunctionCall(r, deps(idempotent))));
      const [patient] = await db.select().from(patients).where(eq(patients.phone, caller));
      const booked = await db
        .select()
        .from(appointments)
        .where(eq(appointments.patientId, patient!.id));
      expect(booked, `idempotency ${idempotent}`).toHaveLength(1);
    }
  }, 120_000);
});
