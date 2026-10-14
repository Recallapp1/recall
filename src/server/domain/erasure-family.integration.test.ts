import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import type { Database } from "../db";
import {
  appointments,
  callbackRequests,
  callPatients,
  calls,
  patients,
  providerDeletions,
} from "../db/schema";
import { ANONYMIZED_CALLBACK_REASON, anonymizePatient } from "./panel";
import { recordingTarget } from "./recording-access";
import { localToUtc } from "./time";

/*
 * KVKK erasure on a number shared by family members with their own records
 * (P-12 step 2): erasing one patient erases that patient's calls only.
 */

const NOW = new Date("2026-10-04T09:00:00Z");
const PHONE = "+905320000073";

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

async function patient(db: Database, clinic: TestClinic, fullName: string) {
  const [row] = await db
    .insert(patients)
    .values({ clinicId: clinic.ctx.clinic.id, fullName, phone: PHONE })
    .returning();
  return row!.id;
}

/** A call with a transcript and a recording, optionally linked to patients. */
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
      providerCallId: `fam-${name}-${Math.random()}`,
      fromNumber,
      transcript: `transcript ${name}`,
      summary: `summary ${name}`,
      recordingUrl: `https://example.invalid/${name}.wav`,
    })
    .returning();
  for (const patientId of linkedTo) {
    await db
      .insert(callPatients)
      .values({ clinicId: clinic.ctx.clinic.id, callId: row!.id, patientId });
  }
  return row!;
}

/** An appointment created by a call (the "creating" link, no call_patients row). */
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
    startsAt: localToUtc("2026-10-05", 10 * 60, tz),
    endsAt: localToUtc("2026-10-05", 10 * 60 + 30, tz),
    source: "voice",
    callId,
  });
}

async function callback(db: Database, clinic: TestClinic, callId: string | null, reason: string) {
  const [row] = await db
    .insert(callbackRequests)
    .values({ clinicId: clinic.ctx.clinic.id, callId, phone: PHONE, patientName: "Aile", reason })
    .returning();
  return row!.id;
}

async function callState(db: Database, ids: string[]) {
  const rows = await db.select().from(calls).where(inArray(calls.id, ids));
  return new Map(rows.map((row) => [row.id, row]));
}

const erased = (row: typeof calls.$inferSelect | undefined) =>
  row !== undefined &&
  row.fromNumber === null &&
  row.transcript === null &&
  row.summary === null &&
  row.recordingUrl === null;

async function queued(db: Database, clinic: TestClinic) {
  const rows = await db
    .select({ providerCallId: providerDeletions.providerCallId })
    .from(providerDeletions)
    .where(eq(providerDeletions.clinicId, clinic.ctx.clinic.id));
  return new Set(rows.map((row) => row.providerCallId));
}

describe("erasure on a number shared by family members (after the P-12 migration (0021))", () => {
  it("erases only the patient's own calls, recordings, callback notes and provider copies", async () => {
    const db = dropped;
    const clinic = await createTestClinic(db);
    const ayse = await patient(db, clinic, "Ayşe Yılmaz");
    const mehmet = await patient(db, clinic, "Mehmet Yılmaz");

    const ayseCall = await call(db, clinic, "ayse", PHONE, [ayse]);
    const mehmetCall = await call(db, clinic, "mehmet", PHONE, [mehmet]);
    const nobodysCall = await call(db, clinic, "nobody", PHONE);
    const bothCall = await call(db, clinic, "both", PHONE, [ayse, mehmet]);
    const mehmetHidden = await call(db, clinic, "mehmet-hidden", null, [mehmet]);
    const ayseHidden = await call(db, clinic, "ayse-hidden", null, [ayse]);
    const mehmetBooking = await call(db, clinic, "mehmet-booking", PHONE);
    await appointmentFrom(db, clinic, mehmet, mehmetBooking.id);

    const mehmetNote = await callback(db, clinic, mehmetCall.id, "Mehmet'in notu");
    const looseNote = await callback(db, clinic, null, "Numaradan not");
    const ayseNote = await callback(db, clinic, ayseCall.id, "Ayşe'nin notu");

    const providerCalls = await anonymizePatient(db, clinic.ctx.clinic.id, ayse, NOW);

    const state = await callState(db, [
      ayseCall.id,
      mehmetCall.id,
      nobodysCall.id,
      bothCall.id,
      mehmetHidden.id,
      ayseHidden.id,
      mehmetBooking.id,
    ]);
    // Ayşe's own calls, a call about both, and a call about nobody from the number.
    for (const own of [ayseCall, ayseHidden, bothCall, nobodysCall]) {
      expect(erased(state.get(own.id)), own.providerCallId).toBe(true);
    }
    // Mehmet's calls keep number, transcript, summary and recording.
    for (const kept of [mehmetCall, mehmetHidden, mehmetBooking]) {
      const row = state.get(kept.id)!;
      expect(row.transcript, kept.providerCallId).not.toBeNull();
      expect(row.recordingUrl, kept.providerCallId).not.toBeNull();
    }
    expect(state.get(mehmetCall.id)!.fromNumber).toBe(PHONE);
    expect(state.get(mehmetBooking.id)!.fromNumber).toBe(PHONE);

    // Recordings: only Mehmet's stay playable.
    const playable = (id: string) =>
      recordingTarget(state.get(id)!, { clinicId: clinic.ctx.clinic.id, providers: ["retell"] });
    expect(playable(ayseCall.id)).toBeNull();
    expect(playable(mehmetCall.id)).not.toBeNull();
    expect(playable(mehmetHidden.id)).not.toBeNull();

    // Provider deletion queue and return value: exactly the erased calls.
    const expected = new Set(
      [ayseCall, ayseHidden, bothCall, nobodysCall].map((c) => c.providerCallId),
    );
    expect(new Set(providerCalls.map((c) => c.providerCallId))).toEqual(expected);
    expect(await queued(db, clinic)).toEqual(expected);

    // Callback notes: Mehmet's stays; the number's loose note and Ayşe's go.
    const notes = await db
      .select()
      .from(callbackRequests)
      .where(inArray(callbackRequests.id, [mehmetNote, looseNote, ayseNote]));
    const note = (id: string) => notes.find((n) => n.id === id)!;
    expect(note(mehmetNote)).toMatchObject({ phone: PHONE, reason: "Mehmet'in notu" });
    expect(note(looseNote)).toMatchObject({ phone: null, reason: ANONYMIZED_CALLBACK_REASON });
    expect(note(ayseNote)).toMatchObject({ phone: null, reason: ANONYMIZED_CALLBACK_REASON });

    // Mehmet's own record is untouched.
    const [mehmetRow] = await db.select().from(patients).where(eq(patients.id, mehmet));
    expect(mehmetRow).toMatchObject({ fullName: "Mehmet Yılmaz", phone: PHONE });

    // Erasing Mehmet afterwards erases his calls too (Ayşe no longer shares the number).
    const second = await anonymizePatient(db, clinic.ctx.clinic.id, mehmet, NOW);
    const after = await callState(db, [mehmetCall.id, mehmetHidden.id, mehmetBooking.id]);
    for (const row of after.values()) expect(erased(row)).toBe(true);
    // The call about both is linked to Mehmet too: returned again (already erased);
    // the deletion queue ignores the duplicate.
    expect(new Set(second.map((c) => c.providerCallId))).toEqual(
      new Set([mehmetCall, mehmetHidden, mehmetBooking, bothCall].map((c) => c.providerCallId)),
    );
    const [bothQueued] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(providerDeletions)
      .where(eq(providerDeletions.providerCallId, bothCall.providerCallId));
    expect(bothQueued!.n).toBe(1);
    const [mehmetQueued] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(providerDeletions)
      .where(
        and(
          eq(providerDeletions.clinicId, clinic.ctx.clinic.id),
          eq(providerDeletions.providerCallId, mehmetCall.providerCallId),
        ),
      );
    expect(mehmetQueued!.n).toBe(1);
  });
});

describe("erasure with one patient per number (today): unchanged", () => {
  it("erases every call from the number, hidden-number calls linked to the patient, and the number's notes", async () => {
    const db = today;
    const clinic = await createTestClinic(db);
    const ayse = await patient(db, clinic, "Ayşe Yılmaz");
    const fromNumber = await call(db, clinic, "from-number", PHONE);
    const linkedHidden = await call(db, clinic, "linked-hidden", null, [ayse]);
    const otherHidden = await call(db, clinic, "other-hidden", null);
    const note = await callback(db, clinic, null, "Not");

    const providerCalls = await anonymizePatient(db, clinic.ctx.clinic.id, ayse, NOW);

    const state = await callState(db, [fromNumber.id, linkedHidden.id, otherHidden.id]);
    expect(erased(state.get(fromNumber.id))).toBe(true);
    expect(erased(state.get(linkedHidden.id))).toBe(true);
    // A withheld-number call about nobody is not the patient's.
    expect(state.get(otherHidden.id)!.transcript).not.toBeNull();
    expect(new Set(providerCalls.map((c) => c.providerCallId))).toEqual(
      new Set([fromNumber.providerCallId, linkedHidden.providerCallId]),
    );
    const [noteRow] = await db.select().from(callbackRequests).where(eq(callbackRequests.id, note));
    expect(noteRow).toMatchObject({ phone: null, reason: ANONYMIZED_CALLBACK_REASON });
  });
});
