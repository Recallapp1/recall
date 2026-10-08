import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createTestClinic, createTestDb } from "@/test/db";

import type { Database } from "../db";
import { callbackRequests, calls, providerDeletions } from "../db/schema";
import { bookAppointment } from "./appointments";
import { linkCallToPatients } from "./call-patients";
import { ANONYMIZED_CALLBACK_REASON, anonymizePatient } from "./panel";
import { ALARM_AFTER_ATTEMPTS, processProviderDeletions } from "./provider-deletions";

/*
 * KVKK erasure across every number a patient's calls came from (audit P-09)
 * and the provider-side deletion queue (audit P-10).
 */

const NOW = new Date("2026-10-04T09:00:00Z");
const PATIENT = "+905320000051";
const RELATIVE = "+905320000052";
const STRANGER = "+905320000053";

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

async function call(clinicId: string, id: string, fromNumber: string | null) {
  const [row] = await db
    .insert(calls)
    .values({
      clinicId,
      provider: "retell",
      providerCallId: id,
      fromNumber,
      transcript: "Hasta: adım Deneme Hasta.",
      summary: "Randevu",
      recordingUrl: "https://rec.test/x.wav",
    })
    .returning({ id: calls.id });
  return row!.id;
}

describe("anonymizePatient", () => {
  it("erases calls about the patient from any number and queues their provider copies", async () => {
    const clinic = await createTestClinic(db);
    const clinicId = clinic.ctx.clinic.id;
    const ownCall = await call(clinicId, "erase-own", PATIENT);
    const relativeCall = await call(clinicId, "erase-relative", RELATIVE);
    const hiddenCall = await call(clinicId, "erase-hidden", null);
    const unrelatedCall = await call(clinicId, "erase-unrelated", STRANGER);

    // A relative books for the patient's number; a withheld caller looks it up.
    const { appointment } = await bookAppointment(db, clinic.ctx, {
      serviceId: clinic.serviceId,
      practitionerId: clinic.practitionerId,
      date: "2026-10-05",
      time: "10:00",
      patientName: "Deneme Hasta",
      patientPhone: PATIENT,
      source: "voice",
      callId: relativeCall,
      now: NOW,
    });
    await linkCallToPatients(db, clinicId, hiddenCall, [appointment.patientId]);
    await db.insert(callbackRequests).values([
      { clinicId, callId: hiddenCall, phone: null, patientName: "Deneme", reason: "Ağrı" },
      { clinicId, callId: unrelatedCall, phone: STRANGER, patientName: "Başka", reason: "Fiyat" },
    ]);

    const erased = await anonymizePatient(db, clinicId, appointment.patientId, NOW);
    expect(erased.map((c) => c.providerCallId).sort()).toEqual([
      "erase-hidden",
      "erase-own",
      "erase-relative",
    ]);

    const rows = await db
      .select()
      .from(calls)
      .where(inArray(calls.id, [ownCall, relativeCall, hiddenCall, unrelatedCall]));
    for (const row of rows) {
      const wiped = row.id !== unrelatedCall;
      expect(row.transcript === null, row.providerCallId).toBe(wiped);
      expect(row.summary === null, row.providerCallId).toBe(wiped);
      expect(row.recordingUrl === null, row.providerCallId).toBe(wiped);
    }

    const notes = await db
      .select()
      .from(callbackRequests)
      .where(eq(callbackRequests.clinicId, clinicId));
    expect(notes.find((n) => n.callId === hiddenCall)).toMatchObject({
      patientName: null,
      phone: null,
      reason: ANONYMIZED_CALLBACK_REASON,
    });
    expect(notes.find((n) => n.callId === unrelatedCall)).toMatchObject({
      patientName: "Başka",
      reason: "Fiyat",
    });

    const queued = await db
      .select()
      .from(providerDeletions)
      .where(eq(providerDeletions.clinicId, clinicId));
    expect(queued.map((q) => q.providerCallId).sort()).toEqual([
      "erase-hidden",
      "erase-own",
      "erase-relative",
    ]);
    expect(queued.every((q) => q.reason === "patient_anonymized" && q.doneAt === null)).toBe(true);
  });
});

describe("processProviderDeletions", () => {
  async function queued(clinicId: string, id: string) {
    await db.insert(providerDeletions).values({
      clinicId,
      provider: "retell",
      providerCallId: id,
      reason: "patient_anonymized",
      nextAttemptAt: NOW,
    });
  }
  const row = async (id: string) =>
    (await db.select().from(providerDeletions).where(eq(providerDeletions.providerCallId, id)))[0]!;

  it("marks a confirmed deletion done", async () => {
    const clinic = await createTestClinic(db);
    await queued(clinic.ctx.clinic.id, "queue-ok");
    const deleted: string[] = [];
    const result = await processProviderDeletions(db, async (_, id) => void deleted.push(id), NOW, {
      providerCallIds: ["queue-ok"],
    });
    expect(result).toEqual({ deleted: 1, failed: 0 });
    expect(deleted).toEqual(["queue-ok"]);
    expect((await row("queue-ok")).doneAt).toEqual(NOW);
  });

  it("backs off after failures, waits until due, and alarms from the third failure", async () => {
    const clinic = await createTestClinic(db);
    await queued(clinic.ctx.clinic.id, "queue-fail");
    const failing = async () => {
      throw Object.assign(new Error("down"), { status: 500 });
    };
    const alarms = vi.spyOn(console, "error").mockImplementation(() => {});

    let now = NOW;
    for (let attempt = 1; attempt <= ALARM_AFTER_ATTEMPTS; attempt += 1) {
      const result = await processProviderDeletions(db, failing, now, {
        providerCallIds: ["queue-fail"],
      });
      expect(result.failed).toBe(1);
      const current = await row("queue-fail");
      expect(current.attempts).toBe(attempt);
      expect(current.lastError).toBe("Error 500");
      // Not due again before its backoff ends.
      expect(current.nextAttemptAt.getTime()).toBeGreaterThan(now.getTime());
      now = current.nextAttemptAt;
    }
    const alarmLines = alarms.mock.calls
      .map(([line]) => String(line))
      .filter((line) => line.includes("voice.provider_deletion_failing"));
    expect(alarmLines).toHaveLength(1);
    alarms.mockRestore();

    // The daily job finally succeeds.
    const done = await processProviderDeletions(db, async () => {}, now, { limit: 50 });
    expect(done.deleted).toBeGreaterThanOrEqual(1);
    expect((await row("queue-fail")).doneAt).not.toBeNull();
  });
});
