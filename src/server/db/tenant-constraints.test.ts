import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb, type TestClinic } from "@/test/db";

import type { Database } from ".";
import * as schema from "./schema";

/**
 * The database itself refuses links across clinics (migration 0013), so a bug
 * in an application filter cannot mix two clinics' data.
 */

let db: Database;
let close: () => Promise<void>;
let a: TestClinic;
let b: TestClinic;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  a = await createTestClinic(db);
  b = await createTestClinic(db);
});
afterAll(async () => {
  await close();
});

/** Drizzle wraps the database error; the trigger's message is on its cause. */
function sameClinicViolation(error: unknown): boolean {
  const cause = (error as { cause?: { message?: string } }).cause;
  return /not in the member's clinic/.test(cause?.message ?? String(error));
}

async function patientOf(clinic: TestClinic, phone: string) {
  const [patient] = await db
    .insert(schema.patients)
    .values({ clinicId: clinic.ctx.clinic.id, fullName: "Test Hasta", phone })
    .returning();
  return patient!;
}

const appointment = (
  clinic: TestClinic,
  overrides: Partial<typeof schema.appointments.$inferInsert> & { patientId: string },
) => ({
  clinicId: clinic.ctx.clinic.id,
  practitionerId: clinic.practitionerId,
  serviceId: clinic.serviceId,
  startsAt: new Date("2026-11-02T07:00:00Z"),
  endsAt: new Date("2026-11-02T07:30:00Z"),
  source: "panel" as const,
  ...overrides,
});

describe("composite tenant foreign keys", () => {
  it("rejects an appointment pointing at another clinic's patient, practitioner or service", async () => {
    const ownPatient = await patientOf(a, "+905550000001");
    const foreignPatient = await patientOf(b, "+905550000002");

    await expect(
      db.insert(schema.appointments).values(appointment(a, { patientId: foreignPatient.id })),
    ).rejects.toThrow();
    await expect(
      db
        .insert(schema.appointments)
        .values(appointment(a, { patientId: ownPatient.id, practitionerId: b.practitionerId })),
    ).rejects.toThrow();
    await expect(
      db
        .insert(schema.appointments)
        .values(appointment(a, { patientId: ownPatient.id, serviceId: b.serviceId })),
    ).rejects.toThrow();
    // The same row inside one clinic is fine.
    await expect(
      db.insert(schema.appointments).values(appointment(a, { patientId: ownPatient.id })),
    ).resolves.toBeDefined();
  });

  it("rejects working hours, time off and service links across clinics", async () => {
    await expect(
      db.insert(schema.workingHours).values({
        clinicId: a.ctx.clinic.id,
        practitionerId: b.practitionerId,
        weekday: 1,
        startTime: "09:00",
        endTime: "12:00",
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(schema.timeOff).values({
        clinicId: a.ctx.clinic.id,
        practitionerId: b.practitionerId,
        startsAt: new Date("2026-11-03T06:00:00Z"),
        endsAt: new Date("2026-11-03T15:00:00Z"),
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(schema.practitionerServices).values({
        clinicId: a.ctx.clinic.id,
        practitionerId: a.practitionerId,
        serviceId: b.serviceId,
      }),
    ).rejects.toThrow();
  });

  it("keeps the appointment and callback when their call is deleted", async () => {
    const [call] = await db
      .insert(schema.calls)
      .values({ clinicId: a.ctx.clinic.id, provider: "retell", providerCallId: "fk_call_1" })
      .returning();
    const patient = await patientOf(a, "+905550000003");
    const [appt] = await db
      .insert(schema.appointments)
      .values(
        appointment(a, {
          patientId: patient.id,
          callId: call!.id,
          startsAt: new Date("2026-11-04T07:00:00Z"),
          endsAt: new Date("2026-11-04T07:30:00Z"),
        }),
      )
      .returning();
    await db.insert(schema.callbackRequests).values({
      clinicId: a.ctx.clinic.id,
      callId: call!.id,
      reason: "Test",
    });
    await db.delete(schema.calls).where(eq(schema.calls.id, call!.id));
    const [after] = await db
      .select()
      .from(schema.appointments)
      .where(eq(schema.appointments.id, appt!.id));
    expect(after).toMatchObject({ clinicId: a.ctx.clinic.id, callId: null });
  });

  it("rejects a callback note pointing at another clinic's call", async () => {
    const [call] = await db
      .insert(schema.calls)
      .values({ clinicId: b.ctx.clinic.id, provider: "retell", providerCallId: "fk_call_2" })
      .returning();
    await expect(
      db.insert(schema.callbackRequests).values({
        clinicId: a.ctx.clinic.id,
        callId: call!.id,
        reason: "Test",
      }),
    ).rejects.toThrow();
  });

  it("keeps a member's practitioner link and calendar preference inside the member's clinic", async () => {
    const [orgA] = await db
      .insert(schema.organizations)
      .values({ name: "A", slug: "fk-org-a" })
      .returning();
    await db
      .update(schema.clinics)
      .set({ organizationId: orgA!.id })
      .where(eq(schema.clinics.id, a.ctx.clinic.id));
    const [user] = await db
      .insert(schema.users)
      .values({ name: "Hekim", email: "fk-hekim@recall.test" })
      .returning();

    await expect(
      db.insert(schema.members).values({
        organizationId: orgA!.id,
        userId: user!.id,
        role: "practitioner",
        practitionerId: b.practitionerId,
      }),
    ).rejects.toSatisfy(sameClinicViolation);

    const [member] = await db
      .insert(schema.members)
      .values({
        organizationId: orgA!.id,
        userId: user!.id,
        role: "practitioner",
        practitionerId: a.practitionerId,
      })
      .returning();
    await expect(
      db
        .insert(schema.memberPreferences)
        .values({ memberId: member!.id, calendarPractitionerId: b.practitionerId }),
    ).rejects.toSatisfy(sameClinicViolation);
    await expect(
      db
        .insert(schema.memberPreferences)
        .values({ memberId: member!.id, calendarPractitionerId: a.practitionerId }),
    ).resolves.toBeDefined();
  });
});
