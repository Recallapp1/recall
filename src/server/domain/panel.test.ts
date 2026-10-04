import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import {
  anonymizePatient,
  changeAppointmentStatus,
  getAppointment,
  getCall,
  getPatient,
  listCalls,
  listPatients,
  listAppointments,
  scopeFor,
  todayOverview,
} from "./panel";
import { localToUtc } from "./time";

let db: Database;
let close: () => Promise<void>;
let a: TestClinic;
let b: TestClinic;
let secondPractitionerId: string;

// Monday 5 October 2026, 10:00 Istanbul.
const now = new Date("2026-10-05T07:00:00Z");

async function insertAppointment(
  clinic: TestClinic,
  input: {
    phone: string;
    name: string;
    minute: number;
    practitionerId?: string;
    status?: schema.Appointment["status"];
    source?: schema.Appointment["source"];
    date?: string;
  },
) {
  const [patient] = await db
    .insert(schema.patients)
    .values({ clinicId: clinic.ctx.clinic.id, fullName: input.name, phone: input.phone })
    .onConflictDoNothing()
    .returning();
  const tz = clinic.ctx.clinic.timezone;
  const date = input.date ?? "2026-10-05";
  const [row] = await db
    .insert(schema.appointments)
    .values({
      clinicId: clinic.ctx.clinic.id,
      patientId: patient!.id,
      practitionerId: input.practitionerId ?? clinic.practitionerId,
      serviceId: clinic.serviceId,
      startsAt: localToUtc(date, input.minute, tz),
      endsAt: localToUtc(date, input.minute + 30, tz),
      status: input.status ?? "scheduled",
      source: input.source ?? "voice",
    })
    .returning();
  return row!;
}

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  a = await createTestClinic(db);
  b = await createTestClinic(db);
  const [second] = await db
    .insert(schema.practitioners)
    .values({ clinicId: a.ctx.clinic.id, name: "Elif Kaya", title: "Dt." })
    .returning();
  secondPractitionerId = second!.id;

  await insertAppointment(a, { phone: "+905320000001", name: "Ayşe Yılmaz", minute: 9 * 60 });
  await insertAppointment(a, {
    phone: "+905320000002",
    name: "Can Tunç",
    minute: 11 * 60,
    practitionerId: secondPractitionerId,
    source: "panel",
  });
  await insertAppointment(a, {
    phone: "+905320000003",
    name: "Deniz Kara",
    minute: 12 * 60,
    status: "cancelled",
  });
  await insertAppointment(a, {
    phone: "+905320000004",
    name: "Ece Bal",
    minute: 9 * 60,
    date: "2026-10-06",
  });
  await insertAppointment(b, { phone: "+905320000009", name: "Başka Klinik", minute: 9 * 60 });
  await db
    .insert(schema.callbackRequests)
    .values({ clinicId: a.ctx.clinic.id, reason: "Fiyat sorusu" });
}, 30_000);

afterAll(async () => close());

describe("panel read models", () => {
  it("lists one clinic's appointments for a day with local minutes and display names", async () => {
    const { rows, total } = await listAppointments(db, scopeFor(a.ctx), {
      from: "2026-10-05",
      to: "2026-10-06",
    });
    expect(total).toBe(3);
    expect(rows.map((row) => row.patientName)).toEqual(["Ayşe Yılmaz", "Can Tunç", "Deniz Kara"]);
    expect(rows[0]).toMatchObject({
      startMinute: 540,
      endMinute: 570,
      practitionerName: "Dt. Can Demir",
    });
  });

  it("filters by status, source and search", async () => {
    const scope = scopeFor(a.ctx);
    const day = { from: "2026-10-05", to: "2026-10-06" };
    expect((await listAppointments(db, scope, { ...day, statuses: ["cancelled"] })).total).toBe(1);
    expect(
      (await listAppointments(db, scope, { ...day, source: "panel" })).rows[0]?.patientName,
    ).toBe("Can Tunç");
    expect((await listAppointments(db, scope, { ...day, search: "ayşe" })).total).toBe(1);
    expect((await listAppointments(db, scope, { ...day, search: "0000002" })).total).toBe(1);
  });

  it("narrows a practitioner to their own calendar", async () => {
    const { rows } = await listAppointments(db, scopeFor(a.ctx, secondPractitionerId), {
      from: "2026-10-05",
      to: "2026-10-06",
    });
    expect(rows.map((row) => row.patientName)).toEqual(["Can Tunç"]);
  });

  it("summarises today", async () => {
    const overview = await todayOverview(db, scopeFor(a.ctx), now);
    expect(overview.date).toBe("2026-10-05");
    expect(overview.appointments).toHaveLength(3);
    expect(overview.stats).toMatchObject({ appointmentsToday: 2, openCallbacks: 1 });
  });
});

describe("tenant isolation", () => {
  it("never returns another clinic's appointment", async () => {
    const { rows } = await listAppointments(db, scopeFor(b.ctx), {
      from: "2026-10-05",
      to: "2026-10-06",
    });
    expect(rows.map((row) => row.patientName)).toEqual(["Başka Klinik"]);

    const foreign = rows[0]!.id;
    expect(await getAppointment(db, scopeFor(a.ctx), foreign)).toBeNull();
    await expect(
      changeAppointmentStatus(db, scopeFor(a.ctx), {
        appointmentId: foreign,
        status: "cancelled",
        now,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("changeAppointmentStatus", () => {
  it("applies allowed transitions and stamps cancellations", async () => {
    const scope = scopeFor(a.ctx);
    const created = await insertAppointment(a, {
      phone: "+905320000005",
      name: "Fatma Su",
      minute: 15 * 60,
    });

    await changeAppointmentStatus(db, scope, {
      appointmentId: created.id,
      status: "confirmed",
      now,
    });
    const result = await changeAppointmentStatus(db, scope, {
      appointmentId: created.id,
      status: "cancelled",
      now,
    });
    expect(result.previous).toBe("confirmed");
    const after = await getAppointment(db, scope, created.id);
    expect(after?.status).toBe("cancelled");
  });

  it("rejects reviving a cancelled appointment", async () => {
    const scope = scopeFor(a.ctx);
    const created = await insertAppointment(a, {
      phone: "+905320000006",
      name: "Gül Ak",
      minute: 16 * 60,
      status: "cancelled",
    });
    await expect(
      changeAppointmentStatus(db, scope, { appointmentId: created.id, status: "confirmed", now }),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });
});

describe("patients", () => {
  it("lists patients with appointment stats and finds them by name or phone", async () => {
    const { rows } = await listPatients(db, scopeFor(a.ctx), { limit: 50, offset: 0, now });
    const ayse = rows.find((row) => row.fullName === "Ayşe Yılmaz");
    expect(ayse).toMatchObject({ appointmentCount: 1 });
    // Her 09:00 appointment is already past at 10:00.
    expect(ayse?.lastAppointmentAt).toBeInstanceOf(Date);
    expect(ayse?.nextAppointmentAt).toBeNull();
    const ece = rows.find((row) => row.fullName === "Ece Bal");
    expect(ece?.nextAppointmentAt).toBeInstanceOf(Date);

    const byPhone = await listPatients(db, scopeFor(a.ctx), {
      search: "0000004",
      limit: 50,
      offset: 0,
      now,
    });
    expect(byPhone.rows.map((row) => row.fullName)).toEqual(["Ece Bal"]);
  });

  it("shows a practitioner only their own patients", async () => {
    const { rows } = await listPatients(db, scopeFor(a.ctx, secondPractitionerId), {
      limit: 50,
      offset: 0,
      now,
    });
    expect(rows.map((row) => row.fullName)).toEqual(["Can Tunç"]);
  });

  it("anonymises a patient and the calls from their number", async () => {
    const created = await insertAppointment(a, {
      phone: "+905320000007",
      name: "Silinecek Kişi",
      minute: 17 * 60,
    });
    const [call] = await db
      .insert(schema.calls)
      .values({
        clinicId: a.ctx.clinic.id,
        provider: "retell",
        providerCallId: "anon-test",
        fromNumber: "+905320000007",
        transcript: "Merhaba, ben Silinecek Kişi.",
        summary: "Randevu aldı.",
      })
      .returning();
    const { patientId } = (await getAppointment(db, scopeFor(a.ctx), created.id))!;

    await anonymizePatient(db, a.ctx.clinic.id, patientId);

    expect(await getPatient(db, scopeFor(a.ctx), patientId)).toBeNull();
    const detail = await getCall(db, scopeFor(a.ctx), call!.id);
    expect(detail).toMatchObject({ fromNumber: null, transcript: null, summary: null });
    const history = await getAppointment(db, scopeFor(a.ctx), created.id);
    expect(history?.patientName).toBe("Anonimleştirilmiş hasta");
    const { rows } = await listPatients(db, scopeFor(a.ctx), {
      search: "Silinecek",
      limit: 50,
      offset: 0,
      now,
    });
    expect(rows).toHaveLength(0);
  });
});

describe("calls", () => {
  it("lists only the clinic's calls and links the caller to a patient", async () => {
    await db.insert(schema.calls).values([
      {
        clinicId: a.ctx.clinic.id,
        provider: "retell",
        providerCallId: "c-a",
        fromNumber: "+905320000001",
        outcome: "booked",
      },
      {
        clinicId: b.ctx.clinic.id,
        provider: "retell",
        providerCallId: "c-b",
        fromNumber: "+905320000009",
      },
    ]);
    const { rows } = await listCalls(db, a.ctx.clinic.id, { limit: 50, offset: 0 });
    expect(rows.some((row) => row.patientName === "Başka Klinik")).toBe(false);
    expect(rows.find((row) => row.fromNumber === "+905320000001")?.patientName).toBe("Ayşe Yılmaz");

    const booked = await listCalls(db, a.ctx.clinic.id, {
      outcome: "booked",
      limit: 50,
      offset: 0,
    });
    expect(booked.rows.every((row) => row.outcome === "booked")).toBe(true);
  });
});
