import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import type { Database } from "../db";
import { appointments, callbackRequests, callPatients, calls, patients } from "../db/schema";
import { exportPatientData, scopeFor } from "./panel";
import { localToUtc } from "./time";

/*
 * KVKK access export on a number shared by family members with their own
 * records (F-02, P-12 step 3): one patient's file holds that patient's calls
 * and callback notes only.
 */

const PHONE = "+905320000074";
const RELATIVE = "+905320000075";

let today: Database;
let dropped: Database;
const closers: (() => Promise<void>)[] = [];

beforeAll(async () => {
  const a = await createTestDb();
  const b = await createTestDb();
  today = a.db;
  dropped = b.db;
  closers.push(a.close, b.close);
  // up.sql of the P-12 proposal (branch docs/P-12-shared-number-proposal), second database only.
  await dropped.execute(
    sql.raw(
      `CREATE INDEX IF NOT EXISTS "patients_clinic_id_phone_idx" ON "patients" ("clinic_id", "phone")`,
    ),
  );
  await dropped.execute(sql.raw(`DROP INDEX IF EXISTS "patients_clinic_id_phone_index"`));
});

afterAll(async () => {
  for (const close of closers) await close();
});

async function patient(db: Database, clinic: TestClinic, fullName: string, phone = PHONE) {
  const [row] = await db
    .insert(patients)
    .values({ clinicId: clinic.ctx.clinic.id, fullName, phone })
    .returning();
  return row!.id;
}

async function call(
  db: Database,
  clinic: TestClinic,
  name: string,
  fromNumber: string | null,
  linkedTo: string[] = [],
) {
  const [row] = await db
    .insert(calls)
    .values({
      clinicId: clinic.ctx.clinic.id,
      provider: "retell",
      providerCallId: `exp-${name}-${Math.random()}`,
      fromNumber,
      summary: name,
      transcript: `transcript ${name}`,
    })
    .returning();
  for (const patientId of linkedTo) {
    await db
      .insert(callPatients)
      .values({ clinicId: clinic.ctx.clinic.id, callId: row!.id, patientId });
  }
  return row!.id;
}

/** The "creating" link: an appointment made in a call, no call_patients row. */
async function appointmentFrom(
  db: Database,
  clinic: TestClinic,
  patientId: string,
  callId: string,
) {
  const tz = clinic.ctx.clinic.timezone;
  await db.insert(appointments).values({
    clinicId: clinic.ctx.clinic.id,
    patientId,
    practitionerId: clinic.practitionerId,
    serviceId: clinic.serviceId,
    startsAt: localToUtc("2026-10-20", 10 * 60, tz),
    endsAt: localToUtc("2026-10-20", 10 * 60 + 30, tz),
    source: "voice",
    callId,
  });
}

async function note(
  db: Database,
  clinic: TestClinic,
  reason: string,
  callId: string | null,
  phone: string | null = PHONE,
) {
  await db.insert(callbackRequests).values({
    clinicId: clinic.ctx.clinic.id,
    callId,
    phone,
    patientName: "Aile",
    reason,
  });
}

async function exported(db: Database, clinic: TestClinic, patientId: string) {
  const data = await exportPatientData(db, scopeFor(clinic.ctx), patientId);
  expect(data).not.toBeNull();
  return {
    calls: data!.aramalar.map((c) => c.ozet).sort(),
    notes: data!.geriAramaTalepleri.map((n) => n.sebep).sort(),
    omitted: "eklenmeyenler" in data! ? data.eklenmeyenler : undefined,
  };
}

describe("export on a number shared by family members (after the P-12 migration (0021))", () => {
  it("holds each patient's own calls and notes; unattributed ones are left out and counted", async () => {
    const db = dropped;
    const clinic = await createTestClinic(db);
    const ayse = await patient(db, clinic, "Ayşe Yılmaz");
    const mehmet = await patient(db, clinic, "Mehmet Yılmaz");

    const ayseCall = await call(db, clinic, "ayse", PHONE, [ayse]);
    const mehmetCall = await call(db, clinic, "mehmet", PHONE, [mehmet]);
    const nobodysCall = await call(db, clinic, "nobody", PHONE);
    await call(db, clinic, "both", PHONE, [ayse, mehmet]);
    await call(db, clinic, "ayse-hidden", null, [ayse]);
    await call(db, clinic, "mehmet-hidden", null, [mehmet]);
    const mehmetBooking = await call(db, clinic, "mehmet-booking", PHONE);
    await appointmentFrom(db, clinic, mehmet, mehmetBooking);

    await note(db, clinic, "ayse-note", ayseCall);
    await note(db, clinic, "mehmet-note", mehmetCall);
    await note(db, clinic, "nobody-call-note", nobodysCall);
    await note(db, clinic, "loose-note", null);
    await note(db, clinic, "ayse-hidden-note", null, null);

    const forAyse = await exported(db, clinic, ayse);
    expect(forAyse.calls).toEqual(["ayse", "ayse-hidden", "both"]);
    expect(forAyse.notes).toEqual(["ayse-note"]);
    expect(forAyse.omitted).toMatchObject({ aramalar: 1, geriAramaTalepleri: 2 });
    expect(forAyse.omitted?.aciklama).toContain("başka hastalarınca");

    const forMehmet = await exported(db, clinic, mehmet);
    expect(forMehmet.calls).toEqual(["both", "mehmet", "mehmet-booking", "mehmet-hidden"]);
    expect(forMehmet.notes).toEqual(["mehmet-note"]);
    expect(forMehmet.omitted).toMatchObject({ aramalar: 1, geriAramaTalepleri: 2 });

    // Nothing of one appears in the other's file.
    expect(forAyse.calls).not.toContain("mehmet");
    expect(forAyse.calls).not.toContain("mehmet-hidden");
    expect(forMehmet.calls).not.toContain("ayse-hidden");
  });
});

describe("export with one patient per number (today)", () => {
  it("keeps every call and note from the number and adds linked withheld-number calls; nothing is omitted", async () => {
    const db = today;
    const clinic = await createTestClinic(db);
    const ayse = await patient(db, clinic, "Ayşe Yılmaz");
    const relative = await patient(db, clinic, "Ali Yılmaz", RELATIVE);

    const unlinked = await call(db, clinic, "unlinked", PHONE);
    await call(db, clinic, "for-relative", PHONE, [relative]);
    const hidden = await call(db, clinic, "hidden-linked", null, [ayse]);
    await call(db, clinic, "relative-own", RELATIVE, [relative]);
    await note(db, clinic, "number-note", null);
    await note(db, clinic, "unlinked-call-note", unlinked);
    await note(db, clinic, "hidden-call-note", hidden, null);

    const forAyse = await exported(db, clinic, ayse);
    // Every call from her number (her voice, even when booking for a relative)
    // and the withheld-number call linked to her.
    expect(forAyse.calls).toEqual(["for-relative", "hidden-linked", "unlinked"]);
    expect(forAyse.notes).toEqual(["hidden-call-note", "number-note", "unlinked-call-note"]);
    expect(forAyse.omitted).toBeUndefined();
  });
});
