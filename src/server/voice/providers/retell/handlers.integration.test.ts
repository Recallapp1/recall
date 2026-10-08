import { eq } from "drizzle-orm";
import { sign } from "retell-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import type { Database } from "../../../db";
import {
  appointments,
  callbackRequests,
  calls,
  clinics,
  notifications,
  patients,
} from "../../../db/schema";
import { dispatchClinicNotifications } from "../../../domain/notifications";
import {
  handleCallEvent,
  handleFunctionCall,
  handleInbound,
  type RetellHandlerDeps,
} from "./handlers";

const API_KEY = "key_test_0123456789";
const NOW = new Date("2026-10-04T09:00:00Z"); // Sunday noon in Istanbul
const CALLER = "+905320000025";
const CALL_ID = "call_retell_1";

let db: Database;
let close: () => Promise<void>;
let clinic: TestClinic;
let other: TestClinic;
let deferred: Array<() => Promise<void>>;
let deletedCalls: string[] = [];
/** What a real SMS provider would have been asked to send. */
let sentSms: Array<{ to: string; body: string }> = [];
/** The dispatcher's switches for the next request (production default: off). */
let sms = { enabled: true, delivers: true };

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

function deps(overrides: Partial<RetellHandlerDeps> = {}): RetellHandlerDeps {
  deferred = [];
  deletedCalls = [];
  return {
    db,
    apiKey: API_KEY,
    now: () => NOW,
    defer: (task) => deferred.push(task),
    smsDelivers: sms.enabled && sms.delivers,
    dispatchClinic: async (clinicId) => {
      await dispatchClinicNotifications(db, clinicId, {
        now: NOW,
        sendingEnabled: sms.enabled,
        provider: {
          delivers: sms.delivers,
          send: async (to, body) => {
            sentSms.push({ to, body });
          },
        },
        providerName: "test",
      });
    },
    deleteProviderCall: async (id) => {
      deletedCalls.push(id);
    },
    ...overrides,
  };
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

async function tool(
  name: string,
  args: Record<string, unknown>,
  callOverrides = {},
  depOverrides: Partial<RetellHandlerDeps> = {},
) {
  const response = await handleFunctionCall(
    await signedRequest({ name, args, call: call(callOverrides) }),
    deps(depOverrides),
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
        dynamic_variables: {
          caller_number: CALLER,
          transfer_available: "hayır",
          clinic_status: "active",
        },
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

  it("declines a caller who keeps dialling (audit P-08)", async () => {
    const limited = await createTestClinic(db, {
      settings: { limits: { callsPerNumberPerHour: 1 } },
    });
    const inbound = (id: string) =>
      signedRequest({
        event: "call_inbound",
        call_inbound: { call_id: id, from_number: "+905320000027", to_number: limited.phoneNumber },
      });
    const first = await handleInbound(await inbound("limit_1"), deps());
    expect((await first.json()).call_inbound.override_agent_id).toBe(limited.agentId);
    const second = await handleInbound(await inbound("limit_2"), deps());
    expect(await second.json()).toEqual({ call_inbound: { reject: true } });
    // A declined call leaves no call record.
    expect(await db.select().from(calls).where(eq(calls.providerCallId, "limit_2"))).toEqual([]);
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
    sentSms = [];
    await Promise.all(deferred.map((task) => task()));
    // Sent through the outbox: logged, and only the date and time in the text.
    expect(sentSms).toHaveLength(1);
    expect(sentSms[0].to).toBe(CALLER);
    expect(sentSms[0].body).not.toContain("Ayşe");
    const [logged] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.subjectId, booking.body.appointmentId));
    expect(logged).toMatchObject({ kind: "appointment_confirmation", status: "sent" });

    const [appointment] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, booking.body.appointmentId));
    expect(appointment).toMatchObject({ source: "voice", clinicId: clinic.ctx.clinic.id });
  });

  it("answers a named time in words: free, or the nearest free times", async () => {
    const free = await tool("check_availability", {
      serviceId: clinic.serviceId,
      date: "2026-10-06",
      time: "14:00",
    });
    expect(free.body).toMatchObject({
      ok: true,
      requestedTime: { time: "14:00", spokenTime: "on dört", available: true },
      slots: [{ time: "14:00" }],
    });

    const closed = await tool("check_availability", {
      serviceId: clinic.serviceId,
      date: "2026-10-06",
      time: "08:00",
    });
    expect(closed.body.requestedTime).toMatchObject({ available: false, spokenTime: "sekiz" });
    expect(closed.body.slots.map((s: { time: string }) => s.time)).toEqual([
      "09:00",
      "09:30",
      "10:00",
    ]);
  });

  it("does not claim an SMS when no SMS channel delivers", async () => {
    const availability = await tool("check_availability", {
      serviceId: clinic.serviceId,
      date: "2026-10-05",
    });
    const slot = availability.body.slots.at(-1);
    sms = { enabled: true, delivers: false };
    try {
      const booking = await tool(
        "book_appointment",
        {
          serviceId: clinic.serviceId,
          practitionerId: slot.practitionerId,
          date: "2026-10-05",
          time: slot.time,
          patientName: "Can Öz",
        },
        { call_id: "nosms_1", from_number: "+905320000001" },
      );
      expect(booking.body).toMatchObject({ ok: true, smsSent: false });
      sentSms = [];
      await Promise.all(deferred.map((task) => task()));
      expect(sentSms).toEqual([]);
      const [logged] = await db
        .select()
        .from(notifications)
        .where(eq(notifications.subjectId, booking.body.appointmentId));
      expect(logged).toMatchObject({ status: "skipped", skipReason: "provider_disabled" });
    } finally {
      sms = { enabled: true, delivers: true };
    }
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

// A stranger must not reach someone else's appointments by speaking their number.
describe("caller identity (abuse cases)", () => {
  const VICTIM = "+905320000021";
  const VICTIM_SPOKEN = "0532 000 00 21";
  let victimAppointmentId: string;

  beforeAll(async () => {
    const booking = await tool(
      "book_appointment",
      {
        serviceId: clinic.serviceId,
        practitionerId: clinic.practitionerId,
        date: "2026-10-07",
        time: "10:00",
        patientName: "Zeynep Şahin",
      },
      { from_number: VICTIM, call_id: "victim_book" },
    );
    expect(booking.body).toMatchObject({ ok: true });
    victimAppointmentId = booking.body.appointmentId;
  });

  async function victimStatus() {
    const [row] = await db
      .select({ status: appointments.status })
      .from(appointments)
      .where(eq(appointments.id, victimAppointmentId));
    return row.status;
  }

  it("ignores a spoken number when caller ID is known (lookup)", async () => {
    const result = await tool("find_appointments", { phone: VICTIM_SPOKEN }, { call_id: "atk_1" });
    expect(JSON.stringify(result.body)).not.toContain(victimAppointmentId);
    expect(JSON.stringify(result.body)).not.toContain("2026-10-07");
  });

  it("ignores a spoken number when caller ID is known (cancel, reschedule)", async () => {
    const cancel = await tool(
      "cancel_appointment",
      { appointmentId: victimAppointmentId, phone: VICTIM_SPOKEN },
      { call_id: "atk_2" },
    );
    expect(cancel.body.ok).toBe(false);
    const reschedule = await tool(
      "reschedule_appointment",
      {
        appointmentId: victimAppointmentId,
        phone: VICTIM_SPOKEN,
        date: "2026-10-08",
        time: "11:00",
      },
      { call_id: "atk_3" },
    );
    expect(reschedule.body.ok).toBe(false);
    expect(await victimStatus()).toBe("scheduled");
  });

  it("reveals nothing about appointments found only through a spoken number", async () => {
    const result = await tool(
      "find_appointments",
      { phone: VICTIM_SPOKEN },
      { from_number: null, call_id: "web_atk_1", call_type: "web_call" },
    );
    expect(result.body).toMatchObject({ ok: true, verificationRequired: true });
    const text = JSON.stringify(result.body);
    expect(text).not.toContain(victimAppointmentId);
    expect(text).not.toContain("2026-10-07");
    expect(text).not.toContain("Ekim");
  });

  it("answers identically whether or not the spoken number has appointments", async () => {
    const withData = await tool(
      "find_appointments",
      { phone: VICTIM_SPOKEN },
      { from_number: null, call_id: "web_atk_2", call_type: "web_call" },
    );
    const without = await tool(
      "find_appointments",
      { phone: "0555 000 11 22" },
      { from_number: null, call_id: "web_atk_3", call_type: "web_call" },
    );
    expect(withData.body).toEqual(without.body);
  });

  it("refuses cancel and reschedule without an ownership check when caller ID is hidden", async () => {
    const web = { from_number: null, call_id: "web_atk_4", call_type: "web_call" };
    const cancel = await tool(
      "cancel_appointment",
      { appointmentId: victimAppointmentId, phone: VICTIM_SPOKEN },
      web,
    );
    expect(cancel.body).toMatchObject({ ok: false, error: "VERIFICATION_REQUIRED" });
    const reschedule = await tool(
      "reschedule_appointment",
      {
        appointmentId: victimAppointmentId,
        phone: VICTIM_SPOKEN,
        date: "2026-10-08",
        time: "11:00",
      },
      web,
    );
    expect(reschedule.body).toMatchObject({ ok: false, error: "VERIFICATION_REQUIRED" });
    expect(await victimStatus()).toBe("scheduled");
  });

  it("rejects a wrong name, date or time, and locks after repeated failures", async () => {
    const web = { from_number: null, call_id: "web_atk_5", call_type: "web_call" };
    const wrong = [
      { patientName: "Ali Veli", appointmentDate: "2026-10-07", appointmentTime: "10:00" },
      { patientName: "Zeynep Şahin", appointmentDate: "2026-10-08", appointmentTime: "10:00" },
      { patientName: "Zeynep Şahin", appointmentDate: "2026-10-07", appointmentTime: "11:00" },
    ];
    for (const verification of wrong) {
      const result = await tool("find_appointments", { phone: VICTIM_SPOKEN, verification }, web);
      expect(result.body).toMatchObject({ ok: false, error: "VERIFICATION_FAILED" });
      expect(JSON.stringify(result.body)).not.toContain(victimAppointmentId);
    }
    // Even the right answer is refused once the call has used up its attempts.
    const locked = await tool(
      "find_appointments",
      {
        phone: VICTIM_SPOKEN,
        verification: {
          patientName: "Zeynep Şahin",
          appointmentDate: "2026-10-07",
          appointmentTime: "10:00",
        },
      },
      web,
    );
    expect(locked.body).toMatchObject({ ok: false, error: "TOO_MANY_ATTEMPTS" });
  });

  it("lets the real patient manage the appointment after name, date and time match", async () => {
    const web = { from_number: null, call_id: "web_owner_1", call_type: "web_call" };
    const verification = {
      patientName: "zeynep sahin", // ASR casing and missing diacritics still match
      appointmentDate: "2026-10-07",
      appointmentTime: "10:00",
    };
    const found = await tool("find_appointments", { phone: VICTIM_SPOKEN, verification }, web);
    expect(found.body).toMatchObject({ ok: true });
    expect(found.body.appointments).toHaveLength(1);
    expect(found.body.appointments[0].appointmentId).toBe(victimAppointmentId);
    // Only what the caller already said: no service or practitioner details.
    expect(found.body.appointments[0].service).toBeUndefined();
    expect(found.body.appointments[0].practitioner).toBeUndefined();

    const cancel = await tool(
      "cancel_appointment",
      { appointmentId: victimAppointmentId, phone: VICTIM_SPOKEN, verification },
      web,
    );
    expect(cancel.body).toMatchObject({ ok: true });
    expect(await victimStatus()).toBe("cancelled");
  });

  it("does not reveal through a booking attempt that a spoken number is busy", async () => {
    await tool(
      "book_appointment",
      {
        serviceId: clinic.serviceId,
        practitionerId: clinic.practitionerId,
        date: "2026-10-09",
        time: "10:00",
        patientName: "Zeynep Şahin",
      },
      { from_number: VICTIM, call_id: "victim_book_2" },
    );
    const probe = await tool(
      "book_appointment",
      {
        serviceId: clinic.serviceId,
        practitionerId: clinic.practitionerId,
        date: "2026-10-09",
        time: "10:00",
        patientName: "Başka Biri",
        patientPhone: VICTIM_SPOKEN,
      },
      { from_number: null, call_id: "web_atk_6", call_type: "web_call" },
    );
    expect(probe.body.ok).toBe(false);
    expect(probe.body.error).not.toBe("PATIENT_BUSY");
    expect(JSON.stringify(probe.body)).not.toContain("adınıza");
  });

  it("still lets a caller with caller ID manage their own appointments", async () => {
    const booking = await tool(
      "book_appointment",
      {
        serviceId: clinic.serviceId,
        practitionerId: clinic.practitionerId,
        date: "2026-10-07",
        time: "14:00",
        patientName: "Ayşe Yılmaz",
      },
      { call_id: "own_1" },
    );
    const found = await tool("find_appointments", {}, { call_id: "own_2" });
    const ids = found.body.appointments.map((a: { appointmentId: string }) => a.appointmentId);
    expect(ids).toContain(booking.body.appointmentId);
    const cancel = await tool(
      "cancel_appointment",
      { appointmentId: booking.body.appointmentId },
      { call_id: "own_3" },
    );
    expect(cancel.body).toMatchObject({ ok: true });
  });
});

describe("replay and abuse limits", () => {
  it("answers a byte-identical replay of a signed tool call without running it again", async () => {
    const body = {
      name: "create_callback_request",
      args: { reason: "Fiyat bilgisi istiyor" },
      call: call({ call_id: "replay_1", from_number: "+905320000099" }),
    };
    const first = await signedRequest(body);
    const replay = new Request(first.url, {
      method: "POST",
      headers: first.headers,
      body: JSON.stringify(body),
    });
    expect(await (await handleFunctionCall(first, deps())).json()).toMatchObject({ ok: true });
    expect(await (await handleFunctionCall(replay, deps())).json()).toMatchObject({
      ok: false,
      error: "DUPLICATE_REQUEST",
    });
    const rows = await db
      .select()
      .from(callbackRequests)
      .where(eq(callbackRequests.phone, "+905320000099"));
    expect(rows).toHaveLength(1);
  });

  it("keeps one callback note per call and number, and caps notes per call", async () => {
    const callOverrides = { call_id: "cb_flood_1", from_number: "+905320000098" };
    const first = await tool("create_callback_request", { reason: "Geri arayın" }, callOverrides);
    const again = await tool("create_callback_request", { reason: "Geri arayın" }, callOverrides);
    expect(first.body).toMatchObject({ ok: true });
    expect(again.body).toMatchObject({ ok: true, alreadyExisted: true });
    const rows = await db
      .select()
      .from(callbackRequests)
      .where(eq(callbackRequests.phone, "+905320000098"));
    expect(rows).toHaveLength(1);

    // Different numbers in one call: three notes at most.
    const results = [];
    for (const n of ["11", "12", "13", "14"]) {
      results.push(
        await tool(
          "create_callback_request",
          { reason: "Not", phone: `0532 000 00 ${n}` },
          { call_id: "cb_flood_2", from_number: null, call_type: "web_call" },
        ),
      );
    }
    expect(results.map((r) => r.body.ok)).toEqual([true, true, true, false]);
    expect(results[3].body).toMatchObject({ error: "RATE_LIMITED" });
  });

  it("stops a runaway tool loop inside one call", async () => {
    let last;
    for (let i = 0; i < 61; i += 1) {
      last = await tool(
        "check_availability",
        { serviceId: clinic.serviceId, date: "2026-10-05" },
        // Distinct bodies: identical ones would be rejected as replays.
        { call_id: "loop_1", start_timestamp: i },
      );
    }
    expect(last!.body).toMatchObject({ ok: false, error: "RATE_LIMITED" });
  });
});

// Every SMS a call triggers goes through the outbox and its locks.
describe("SMS from voice tools", () => {
  const PHONE = "+905320000024";
  const book = (time: string, callId: string) =>
    tool(
      "book_appointment",
      {
        serviceId: clinic.serviceId,
        practitionerId: clinic.practitionerId,
        date: "2026-10-12",
        time,
        patientName: "Deniz Ak",
      },
      { from_number: PHONE, call_id: callId },
    );
  const runDeferred = async () => {
    sentSms = [];
    await Promise.all(deferred.map((task) => task()));
  };
  const logFor = async (appointmentId: string) =>
    db.select().from(notifications).where(eq(notifications.subjectId, appointmentId));

  it("sends nothing while the master switch is off, and logs why", async () => {
    sms = { enabled: false, delivers: true };
    try {
      const booking = await book("09:00", "sms_off_1");
      expect(booking.body).toMatchObject({ ok: true, smsSent: false });
      await runDeferred();
      expect(sentSms).toEqual([]);
      expect(await logFor(booking.body.appointmentId)).toMatchObject([
        { status: "skipped", skipReason: "sending_disabled" },
      ]);
    } finally {
      sms = { enabled: true, delivers: true };
    }
  });

  it("respects the patient's SMS opt-out for confirmation, cancellation and reschedule", async () => {
    await db.update(patients).set({ smsOptOutAt: NOW }).where(eq(patients.phone, PHONE));
    try {
      const booking = await book("10:00", "sms_optout_1");
      expect(booking.body).toMatchObject({ ok: true, smsSent: false });
      await runDeferred();
      const moved = await tool(
        "reschedule_appointment",
        { appointmentId: booking.body.appointmentId, date: "2026-10-12", time: "11:00" },
        { from_number: PHONE, call_id: "sms_optout_2" },
      );
      expect(moved.body.ok).toBe(true);
      await runDeferred();
      const cancelled = await tool(
        "cancel_appointment",
        { appointmentId: moved.body.appointment.appointmentId },
        { from_number: PHONE, call_id: "sms_optout_3" },
      );
      expect(cancelled.body.ok).toBe(true);
      await runDeferred();
      expect(sentSms).toEqual([]);
      const rows = [
        ...(await logFor(booking.body.appointmentId)),
        ...(await logFor(moved.body.appointment.appointmentId)),
      ];
      expect(rows.map((r) => [r.kind, r.status, r.skipReason]).sort()).toEqual(
        [
          ["appointment_cancellation", "skipped", "opted_out"],
          ["appointment_confirmation", "skipped", "opted_out"],
          ["appointment_rescheduled", "skipped", "opted_out"],
        ].sort(),
      );
    } finally {
      await db.update(patients).set({ smsOptOutAt: null }).where(eq(patients.phone, PHONE));
    }
  });

  it("waits for the send window instead of texting at night", async () => {
    const night = new Date("2026-10-04T19:30:00Z"); // 22:30 in Istanbul
    const booking = await tool(
      "book_appointment",
      {
        serviceId: clinic.serviceId,
        practitionerId: clinic.practitionerId,
        date: "2026-10-12",
        time: "14:00",
        patientName: "Deniz Ak",
      },
      { from_number: PHONE, call_id: "sms_night_1" },
      { now: () => night },
    );
    expect(booking.body.ok).toBe(true);
    // The dispatcher runs with its own clock; at night nothing goes out.
    await dispatchClinicNotifications(db, clinic.ctx.clinic.id, {
      now: night,
      sendingEnabled: true,
      provider: { delivers: true, send: async () => expect.fail("sent at night") },
      providerName: "test",
    });
    expect(await logFor(booking.body.appointmentId)).toMatchObject([{ status: "pending" }]);
  });

  it("does not text the clinic's patients when the clinic turned confirmations off", async () => {
    await db
      .update(clinics)
      .set({
        settings: { ...clinic.ctx.clinic.settings, notifications: { smsConfirmation: false } },
      })
      .where(eq(clinics.id, clinic.ctx.clinic.id));
    try {
      const booking = await book("15:00", "sms_clinic_off_1");
      expect(booking.body).toMatchObject({ ok: true, smsSent: false });
      await runDeferred();
      expect(sentSms).toEqual([]);
      expect(await logFor(booking.body.appointmentId)).toEqual([]);
    } finally {
      await db
        .update(clinics)
        .set({ settings: clinic.ctx.clinic.settings })
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
    // Recording is on: the call stays on the provider until its retention ends.
    await Promise.all(deferred.map((task) => task()));
    expect(deletedCalls).toEqual([]);
  });

  it("deletes the call on the provider after analysis when recording is off", async () => {
    const quiet = await createTestClinic(db, {
      settings: { assistant: { recordCalls: false } },
    });
    const quietCall = {
      call_id: "call_quiet_1",
      agent_id: quiet.agentId,
      call_type: "web_call",
      duration_ms: 60_000,
      transcript: "Agent: Merhaba",
      recording_url: "https://rec.test/q.wav",
    };
    await handleCallEvent(await signedRequest({ event: "call_ended", call: quietCall }), deps());
    expect(deferred).toHaveLength(0);

    await handleCallEvent(
      await signedRequest({
        event: "call_analyzed",
        call: { ...quietCall, call_analysis: { call_summary: "Bilgi aldı." } },
      }),
      deps(),
    );
    await Promise.all(deferred.map((task) => task()));
    expect(deletedCalls).toEqual(["call_quiet_1"]);

    const [row] = await db.select().from(calls).where(eq(calls.providerCallId, "call_quiet_1"));
    // Transcript and summary stay with us; no recording link is kept.
    expect(row).toMatchObject({
      transcript: "Agent: Merhaba",
      summary: "Bilgi aldı.",
      recordingUrl: null,
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

describe("repeated change requests", () => {
  // A re-signed retry of a request that already succeeded (audit P-11).
  const caller = { from_number: "+905320000026", call_id: "call_retry_1" };
  const again = () => new Promise((resolve) => setTimeout(resolve, 5));

  it("reports a repeated cancellation and a repeated move as done", async () => {
    const booked = await tool(
      "book_appointment",
      {
        serviceId: clinic.serviceId,
        practitionerId: clinic.practitionerId,
        date: "2026-10-08",
        time: "14:00",
        patientName: "Deneme Hasta",
      },
      caller,
    );
    expect(booked.body).toMatchObject({ ok: true });

    const move = {
      appointmentId: booked.body.appointmentId,
      date: "2026-10-08",
      time: "15:00",
    };
    const moved = await tool("reschedule_appointment", move, caller);
    await again();
    const movedAgain = await tool("reschedule_appointment", move, caller);
    expect(moved.body).toMatchObject({ ok: true, alreadyRescheduled: false });
    expect(movedAgain.body).toMatchObject({ ok: true, alreadyRescheduled: true });
    expect(movedAgain.body.appointment.appointmentId).toBe(moved.body.appointment.appointmentId);

    const cancel = { appointmentId: moved.body.appointment.appointmentId };
    const cancelled = await tool("cancel_appointment", cancel, caller);
    await again();
    const cancelledAgain = await tool("cancel_appointment", cancel, caller);
    expect(cancelled.body).toMatchObject({ ok: true, alreadyCancelled: false });
    expect(cancelledAgain.body).toMatchObject({ ok: true, alreadyCancelled: true });
  });
});
