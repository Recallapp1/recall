import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import type { Database } from "../db";
import {
  appointments,
  auditEvents,
  callbackRequests,
  calls,
  clinics,
  patients,
  phoneNumbers,
  providerDeletions,
} from "../db/schema";
import { bookAppointment } from "./appointments";
import { eraseClinicData, exportClinicData, purgeClinic } from "./offboarding";
import { isErasedProviderCall } from "./provider-deletions";

/*
 * Full audit A16: closing a clinic. Export first, then erase personal data
 * (provider copies queued for deletion, clinic paused, numbers off), and
 * delete the clinic only once the provider has confirmed every deletion.
 */

const NOW = new Date("2026-10-14T09:00:00Z");

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

async function seed(clinic: TestClinic, suffix: string) {
  const clinicId = clinic.ctx.clinic.id;
  const { appointment } = await bookAppointment(db, clinic.ctx, {
    serviceId: clinic.serviceId,
    practitionerId: clinic.practitionerId,
    date: "2026-10-20",
    time: "10:00",
    patientName: `Kapanış Hasta ${suffix}`,
    patientPhone: `+90532000${suffix}`,
    source: "panel",
    now: NOW,
  });
  await db.insert(calls).values({
    clinicId,
    provider: "retell",
    providerCallId: `call_offboard_${suffix}`,
    transcript: "Merhaba",
    fromNumber: `+90532000${suffix}`,
  });
  await db.insert(callbackRequests).values({ clinicId, reason: "Geri arayın" });
  return appointment;
}

describe("clinic offboarding", () => {
  it("exports one clinic's data and nothing of another clinic", async () => {
    const clinic = await createTestClinic(db);
    const other = await createTestClinic(db);
    await seed(clinic, "0101");
    await seed(other, "0102");

    const data = await exportClinicData(db, clinic.ctx.clinic.id);
    expect(data.clinic.id).toBe(clinic.ctx.clinic.id);
    expect(data.patients.map((p) => p.fullName)).toEqual(["Kapanış Hasta 0101"]);
    expect(data.appointments).toHaveLength(1);
    expect(data.calls).toHaveLength(1);
    expect(data.callbackRequests).toHaveLength(1);
    expect(data.practitioners).toHaveLength(1);
    expect(data.services).toHaveLength(1);
  });

  it("erase removes personal data, queues provider deletions, pauses the clinic; the other clinic is untouched", async () => {
    const clinic = await createTestClinic(db);
    const other = await createTestClinic(db);
    await seed(clinic, "0201");
    await seed(other, "0202");
    const clinicId = clinic.ctx.clinic.id;

    const result = await eraseClinicData(db, clinicId, NOW);
    expect(result).toMatchObject({ patients: 1, appointments: 1, calls: 1, callbackRequests: 1 });
    expect(result.providerDeletionsQueued).toBe(1);

    for (const table of [patients, appointments, calls, callbackRequests]) {
      expect(await db.select().from(table).where(eq(table.clinicId, clinicId))).toEqual([]);
      expect(
        await db.select().from(table).where(eq(table.clinicId, other.ctx.clinic.id)),
      ).toHaveLength(1);
    }
    const [row] = await db.select().from(clinics).where(eq(clinics.id, clinicId));
    expect(row!.status).toBe("paused");
    const numbers = await db.select().from(phoneNumbers).where(eq(phoneNumbers.clinicId, clinicId));
    expect(numbers.every((n) => !n.isActive)).toBe(true);
    const [queued] = await db
      .select()
      .from(providerDeletions)
      .where(eq(providerDeletions.clinicId, clinicId));
    expect(queued).toMatchObject({ providerCallId: "call_offboard_0201", reason: "clinic_closed" });
    // Late provider events for the deleted call must not write it back.
    expect(await isErasedProviderCall(db, clinicId, "retell", "call_offboard_0201")).toBe(true);
    const audit = await db.select().from(auditEvents).where(eq(auditEvents.clinicId, clinicId));
    expect(audit.map((a) => a.action)).toContain("clinic.data_erased");
  });

  it("purge refuses while provider deletions are pending, then deletes the clinic and leaves a receipt", async () => {
    const clinic = await createTestClinic(db);
    await seed(clinic, "0301");
    const clinicId = clinic.ctx.clinic.id;

    await expect(purgeClinic(db, clinicId, NOW)).rejects.toThrow(/before erase/);
    await eraseClinicData(db, clinicId, NOW);
    await expect(purgeClinic(db, clinicId, NOW)).rejects.toThrow(/1 provider deletion/);

    await db
      .update(providerDeletions)
      .set({ doneAt: NOW })
      .where(eq(providerDeletions.clinicId, clinicId));
    const receipt = await purgeClinic(db, clinicId, NOW);
    expect(receipt).toMatchObject({ slug: clinic.ctx.clinic.slug, providerDeletionsDone: 1 });

    expect(await db.select().from(clinics).where(eq(clinics.id, clinicId))).toEqual([]);
    const platformAudit = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "clinic.purged"));
    expect(platformAudit.map((a) => a.targetId)).toContain(clinicId);
    expect(JSON.stringify(platformAudit)).not.toContain("Kapanış Hasta");
  });
});
