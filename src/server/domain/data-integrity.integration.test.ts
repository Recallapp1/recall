import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb } from "@/test/db";

import type { Database } from "../db";
import { callPatients, calls } from "../db/schema";
import { bookAppointment } from "./appointments";
import { createCallbackRequest } from "./calls";
import { enqueueAppointmentMessage } from "./notifications";
import { anonymizePatient } from "./panel";

/*
 * R2 4j: no orphaned or still-addressable rows after a KVKK erasure, and
 * Turkish names stored the same way whatever case or letters were spoken.
 * Follow-up plans going with the erasure are tested in follow-ups.test.ts.
 */

const NOW = new Date("2026-10-04T09:00:00Z");
const PHONE = "+905320000091";

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

async function count(query: ReturnType<typeof sql>): Promise<number> {
  const result = await db.execute(query);
  return Number((result.rows[0] as { n: number | string }).n);
}

describe("after an erasure (R2 4j)", () => {
  it("leaves no pending message, no message tied to the patient and no dangling subject", async () => {
    const clinic = await createTestClinic(db);
    const { appointment } = await bookAppointment(db, clinic.ctx, {
      serviceId: clinic.serviceId,
      practitionerId: clinic.practitionerId,
      date: "2026-10-05",
      time: "10:00",
      patientName: "Silinecek Hasta",
      patientPhone: PHONE,
      source: "panel",
      now: NOW,
    });
    await enqueueAppointmentMessage(db, {
      clinicId: clinic.ctx.clinic.id,
      kind: "appointment_confirmation",
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      now: NOW,
    });
    const [call] = await db
      .insert(calls)
      .values({
        clinicId: clinic.ctx.clinic.id,
        provider: "retell",
        providerCallId: "integrity-1",
        fromNumber: PHONE,
        transcript: "Agent: Merhaba",
      })
      .returning();
    await db.insert(callPatients).values({
      clinicId: clinic.ctx.clinic.id,
      callId: call!.id,
      patientId: appointment.patientId,
    });
    await createCallbackRequest(db, {
      clinicId: clinic.ctx.clinic.id,
      callId: call!.id,
      reason: "Geri arayın",
      patientName: "Silinecek Hasta",
      phone: PHONE,
    });

    await anonymizePatient(db, clinic.ctx.clinic.id, appointment.patientId, NOW);
    const clinicId = clinic.ctx.clinic.id;

    expect(
      await count(sql`select count(*) as n from notifications
        where clinic_id = ${clinicId} and patient_id = ${appointment.patientId}`),
    ).toBe(0);
    expect(
      await count(sql`select count(*) as n from notifications
        where clinic_id = ${clinicId} and status = 'pending'`),
    ).toBe(0);
    // Every message's subject still exists (appointment or follow-up plan).
    expect(
      await count(sql`select count(*) as n from notifications n
        where n.clinic_id = ${clinicId}
          and not exists (select 1 from appointments a where a.id = n.subject_id)
          and not exists (select 1 from follow_up_plans f where f.id = n.subject_id)
          and n.status = 'pending'`),
    ).toBe(0);
    // Links point at the anonymised record, which carries no identity.
    expect(
      await count(sql`select count(*) as n from call_patients cp
        join patients p on p.id = cp.patient_id
        where cp.clinic_id = ${clinicId} and p.phone not like 'anon:%'`),
    ).toBe(0);
    expect(
      await count(sql`select count(*) as n from callback_requests
        where clinic_id = ${clinicId} and (phone is not null or patient_name is not null)`),
    ).toBe(0);
    expect(
      await count(sql`select count(*) as n from calls
        where clinic_id = ${clinicId} and (from_number is not null or transcript is not null)`),
    ).toBe(0);
  });
});

describe("Turkish names (R2 4j)", () => {
  it.each([
    ["ayşe yılmaz", "Ayşe Yılmaz"],
    ["İSMAİL IŞIK", "İsmail Işık"],
    ["  zeynep   öztürk ", "Zeynep Öztürk"],
  ])("a booking spoken as %s is stored as %s", async (spoken, stored) => {
    const clinic = await createTestClinic(db);
    const { appointment } = await bookAppointment(db, clinic.ctx, {
      serviceId: clinic.serviceId,
      practitionerId: clinic.practitionerId,
      date: "2026-10-05",
      time: "11:00",
      patientName: spoken,
      patientPhone: "+905320000092",
      source: "panel",
      now: NOW,
    });
    expect(appointment.patientName).toBe(stored);
  });
});
