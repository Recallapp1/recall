import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import type { Database } from "../db";
import { callbackRequests, callPatients, calls, patients, providerDeletions } from "../db/schema";
import { bookAppointment } from "./appointments";
import { ANONYMIZED_CALLBACK_REASON, anonymizePatient, exportPatientData, scopeFor } from "./panel";
import { updatePatientIdentity } from "./panel";

/*
 * Phone correction (PANEL_PATIENT_EDIT) keeps the patient's history (full
 * audit FA-02): calls and callback notes from the old number stay reachable
 * by export and erasure. Run on today's schema and after the P-12 migration (0021).
 */

const NOW = new Date("2026-10-04T09:00:00Z");
const OLD = "+905320000051";
const NEW = "+905320000052";

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

async function book(db: Database, clinic: TestClinic, time: string, patientName: string) {
  const { appointment } = await bookAppointment(db, clinic.ctx, {
    serviceId: clinic.serviceId,
    practitionerId: clinic.practitionerId,
    date: "2026-10-05",
    time,
    patientName,
    patientPhone: OLD,
    source: "panel",
    patientsPerName: true,
    now: NOW,
  });
  return appointment.patientId;
}

async function call(db: Database, clinic: TestClinic, name: string, linkedTo: string[] = []) {
  const [row] = await db
    .insert(calls)
    .values({
      clinicId: clinic.ctx.clinic.id,
      provider: "retell",
      providerCallId: `corr-${name}-${Math.random()}`,
      fromNumber: OLD,
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

async function note(db: Database, clinic: TestClinic, callId: string | null) {
  const [row] = await db
    .insert(callbackRequests)
    .values({
      clinicId: clinic.ctx.clinic.id,
      callId,
      phone: OLD,
      patientName: "Deneme",
      reason: "Lütfen arayın",
    })
    .returning();
  return row!;
}

const correct = (db: Database, clinic: TestClinic, patientId: string, fullName: string) =>
  updatePatientIdentity(db, clinic.ctx.clinic.id, { patientId, fullName, phone: NEW });

async function callRow(db: Database, id: string) {
  const [row] = await db.select().from(calls).where(eq(calls.id, id));
  return row!;
}

async function noteRow(db: Database, id: string) {
  const [row] = await db.select().from(callbackRequests).where(eq(callbackRequests.id, id));
  return row!;
}

const schemas = [
  ["today's schema", () => today],
  ["after the P-12 migration (0021)", () => dropped],
] as const;

describe.each(schemas)("phone correction keeps the history (%s)", (_, database) => {
  it("alone on the old number: export still shows its calls and notes, erasure removes them", async () => {
    const db = database();
    const clinic = await createTestClinic(db);
    const patientId = await book(db, clinic, "10:00", "Deneme Kisi");
    const unlinked = await call(db, clinic, "unlinked");
    const withNote = await call(db, clinic, "noted");
    const noteFromCall = await note(db, clinic, withNote.id);
    const looseNote = await note(db, clinic, null);

    await correct(db, clinic, patientId, "Deneme Kisi");

    const exported = await exportPatientData(db, scopeFor(clinic.ctx), patientId);
    expect(exported?.hasta.telefon).toBe(NEW);
    expect(exported?.aramalar.map((c) => c.dokum).sort()).toEqual([
      "transcript noted",
      "transcript unlinked",
    ]);
    expect(exported?.geriAramaTalepleri).toHaveLength(2);

    await anonymizePatient(db, clinic.ctx.clinic.id, patientId, NOW);

    for (const id of [unlinked.id, withNote.id]) {
      const row = await callRow(db, id);
      expect(row.transcript).toBeNull();
      expect(row.fromNumber).toBeNull();
      expect(row.recordingUrl).toBeNull();
    }
    for (const id of [noteFromCall.id, looseNote.id]) {
      const row = await noteRow(db, id);
      expect(row.phone).toBeNull();
      expect(row.reason).toBe(ANONYMIZED_CALLBACK_REASON);
    }
    const queued = await db
      .select({ id: providerDeletions.providerCallId })
      .from(providerDeletions)
      .where(eq(providerDeletions.clinicId, clinic.ctx.clinic.id));
    expect(queued.map((row) => row.id).sort()).toEqual(
      [unlinked.providerCallId, withNote.providerCallId].sort(),
    );
  });

  it("a name-only correction moves nothing", async () => {
    const db = database();
    const clinic = await createTestClinic(db);
    const patientId = await book(db, clinic, "10:00", "Deneme Kisi");
    const unlinked = await call(db, clinic, "unlinked");
    await updatePatientIdentity(db, clinic.ctx.clinic.id, {
      patientId,
      fullName: "Deneme Kisi Yeni",
      phone: OLD,
    });
    const links = await db.select().from(callPatients).where(eq(callPatients.callId, unlinked.id));
    expect(links).toHaveLength(0);
  });
});

describe("phone correction on a number shared by family members (after the P-12 migration (0021))", () => {
  it("leaves the number's calls and notes with the number; the family's own calls stay theirs", async () => {
    const db = dropped;
    const clinic = await createTestClinic(db);
    const parent = await book(db, clinic, "10:00", "Deneme Veli");
    const child = await book(db, clinic, "11:00", "Deneme Cocuk");
    expect(child).not.toBe(parent);
    const childsCall = await call(db, clinic, "child", [child]);
    const parentsCall = await call(db, clinic, "parent", [parent]);
    const unlinked = await call(db, clinic, "unlinked");
    const looseNote = await note(db, clinic, null);

    await correct(db, clinic, parent, "Deneme Veli");

    const [stillOld] = await db.select().from(patients).where(eq(patients.id, child));
    expect(stillOld!.phone).toBe(OLD);
    expect((await noteRow(db, looseNote.id)).phone).toBe(OLD);

    const exported = await exportPatientData(db, scopeFor(clinic.ctx), parent);
    expect(exported?.aramalar.map((c) => c.dokum)).toEqual(["transcript parent"]);

    await anonymizePatient(db, clinic.ctx.clinic.id, parent, NOW);

    expect((await callRow(db, parentsCall.id)).transcript).toBeNull();
    expect((await callRow(db, childsCall.id)).transcript).toBe("transcript child");
    expect((await callRow(db, unlinked.id)).transcript).toBe("transcript unlinked");
    expect((await noteRow(db, looseNote.id)).phone).toBe(OLD);
  });
});
