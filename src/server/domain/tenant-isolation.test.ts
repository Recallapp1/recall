import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import type { Database } from "../db";
import { callbackRequests, calls } from "../db/schema";
import { bookAppointment, findUpcomingAppointments } from "./appointments";
import {
  changeAppointmentStatus,
  exportPatientData,
  getAppointment,
  getCall,
  getPatient,
  listAppointments,
  listCallbacks,
  listCalls,
  listPatients,
  scopeFor,
  setCallbackStatus,
  todayOverview,
  updateAppointmentNotes,
  updatePatientNotes,
} from "./panel";
import { clinicUsage } from "./voice-limits";

/*
 * Every panel query family, asked from clinic B about clinic A's rows
 * (audit A10): nothing is returned and nothing is changed.
 */

const NOW = new Date("2026-10-04T09:00:00Z");
const PHONE = "+905320000095";

let db: Database;
let close: () => Promise<void>;
let a: TestClinic;
let b: TestClinic;
const ids = { appointment: "", patient: "", call: "", callback: "" };

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  a = await createTestClinic(db);
  b = await createTestClinic(db);
  const [call] = await db
    .insert(calls)
    .values({
      clinicId: a.ctx.clinic.id,
      provider: "retell",
      providerCallId: "iso-call",
      fromNumber: PHONE,
      transcript: "Agent: Merhaba",
      startedAt: NOW,
    })
    .returning({ id: calls.id });
  ids.call = call!.id;
  const { appointment } = await bookAppointment(db, a.ctx, {
    serviceId: a.serviceId,
    practitionerId: a.practitionerId,
    date: "2026-10-05",
    time: "10:00",
    patientName: "İzole Hasta",
    patientPhone: PHONE,
    source: "voice",
    callId: ids.call,
    now: NOW,
  });
  ids.appointment = appointment.id;
  ids.patient = appointment.patientId;
  const [callback] = await db
    .insert(callbackRequests)
    .values({ clinicId: a.ctx.clinic.id, phone: PHONE, reason: "Geri arama" })
    .returning({ id: callbackRequests.id });
  ids.callback = callback!.id;
});

afterAll(async () => {
  await close();
});

describe("clinic B never sees or changes clinic A's data", () => {
  const scopeB = () => scopeFor(b.ctx);

  it("appointments: list, detail, today, notes and status", async () => {
    const list = await listAppointments(db, scopeB(), { from: "2026-10-05", to: "2026-10-06" });
    expect(list.rows).toEqual([]);
    expect(await getAppointment(db, scopeB(), ids.appointment)).toBeNull();
    expect((await todayOverview(db, scopeB(), NOW)).appointments).toEqual([]);
    await expect(
      updateAppointmentNotes(db, scopeB(), { appointmentId: ids.appointment, notes: "x" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      changeAppointmentStatus(db, scopeB(), {
        appointmentId: ids.appointment,
        status: "cancelled",
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Still intact for clinic A.
    expect((await getAppointment(db, scopeFor(a.ctx), ids.appointment))?.status).toBe("scheduled");
  });

  it("patients: list, search, detail, export and notes", async () => {
    expect((await listPatients(db, scopeB(), { limit: 50, offset: 0, now: NOW })).rows).toEqual([]);
    expect(
      (await listPatients(db, scopeB(), { search: "İzole", limit: 50, offset: 0, now: NOW })).rows,
    ).toEqual([]);
    expect(await getPatient(db, scopeB(), ids.patient)).toBeNull();
    expect(await exportPatientData(db, scopeB(), ids.patient)).toBeNull();
    await expect(
      updatePatientNotes(db, b.ctx.clinic.id, { patientId: ids.patient, notes: "x" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("calls, recordings and callbacks", async () => {
    expect((await listCalls(db, b.ctx.clinic.id, { limit: 50, offset: 0 })).rows).toEqual([]);
    expect(await getCall(db, scopeB(), ids.call)).toBeNull();
    expect(await listCallbacks(db, b.ctx.clinic.id, "open")).toEqual([]);
    await expect(
      setCallbackStatus(db, b.ctx.clinic.id, {
        callbackId: ids.callback,
        status: "done",
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("voice lookups and usage", async () => {
    expect(await findUpcomingAppointments(db, b.ctx, PHONE, NOW)).toEqual([]);
    expect(await clinicUsage(db, b.ctx, NOW)).toMatchObject({
      callsToday: 0,
      voiceBookingsToday: 0,
    });
  });
});
