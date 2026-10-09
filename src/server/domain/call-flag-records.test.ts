import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb } from "@/test/db";

import type { Database } from "../db";
import { calls } from "../db/schema";
import { bookAppointment, cancelAppointment } from "./appointments";
import { flagCall } from "./call-flag-records";
import { linkCallToPatients } from "./call-patients";

const NOW = new Date("2026-10-04T09:00:00Z");
const PHONE = "+905320000061";

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

async function call(clinicId: string, id: string, transcript: string) {
  const [row] = await db
    .insert(calls)
    .values({
      clinicId,
      provider: "retell",
      providerCallId: id,
      transcript,
      startedAt: new Date(NOW.getTime() - 60_000),
      endedAt: new Date(NOW.getTime() + 60_000),
    })
    .returning({ id: calls.id });
  return row!.id;
}

describe("flagCall", () => {
  it("accepts claims backed by a booking and a cancellation made in the call", async () => {
    const clinic = await createTestClinic(db);
    const clinicId = clinic.ctx.clinic.id;
    const bookingCall = await call(clinicId, "fact-book", "Agent: Randevunuz oluşturuldu.");
    const { appointment } = await bookAppointment(db, clinic.ctx, {
      serviceId: clinic.serviceId,
      practitionerId: clinic.practitionerId,
      date: "2026-10-05",
      time: "10:00",
      patientName: "Deneme Hasta",
      patientPhone: PHONE,
      source: "voice",
      callId: bookingCall,
      now: NOW,
    });
    expect(await flagCall(db, clinicId, bookingCall, NOW)).toEqual([]);

    const cancelCall = await call(clinicId, "fact-cancel", "Agent: Randevunuz iptal edildi.");
    await linkCallToPatients(db, clinicId, cancelCall, [appointment.patientId]);
    // Before the cancellation the claim is unbacked; after it, it is backed.
    expect(await flagCall(db, clinicId, cancelCall, NOW)).toEqual(["unbacked_claim"]);
    await cancelAppointment(db, clinic.ctx, {
      appointmentId: appointment.id,
      phone: PHONE,
      now: NOW,
    });
    expect(await flagCall(db, clinicId, cancelCall, NOW)).toEqual([]);
  });

  it("never reads another clinic's call", async () => {
    const a = await createTestClinic(db);
    const b = await createTestClinic(db);
    const callId = await call(a.ctx.clinic.id, "fact-other", "Agent: Randevunuz oluşturuldu.");
    expect(await flagCall(db, b.ctx.clinic.id, callId, NOW)).toEqual([]);
  });
});
