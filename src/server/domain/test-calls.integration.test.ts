import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb } from "@/test/db";

import type { Database } from "../db";
import { appointments, auditEvents, calls } from "../db/schema";
import { localToUtc } from "./time";
import { isTestCall, scopeFor, todayOverview } from "./panel";

/* R2 5e: test calls are left out of the "Bugün" numbers with TEST_CALL_FLAG. */

const NOW = new Date("2026-10-05T09:00:00Z"); // Monday noon in Istanbul

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

describe("test calls in the daily numbers (R2 5e)", () => {
  it("off: every call counts; on: marked calls and their bookings do not; unmarking restores them", async () => {
    const clinic = await createTestClinic(db);
    const clinicId = clinic.ctx.clinic.id;
    const [testCall, realCall] = await db
      .insert(calls)
      .values([
        { clinicId, provider: "retell", providerCallId: "test-mark-1", createdAt: NOW },
        { clinicId, provider: "retell", providerCallId: "test-mark-2", createdAt: NOW },
      ])
      .returning();
    const { patients } = await import("../db/schema");
    const [patient] = await db
      .insert(patients)
      .values({ clinicId, fullName: "Deneme Hasta", phone: "+905320000096" })
      .returning();
    const tz = clinic.ctx.clinic.timezone;
    await db.insert(appointments).values({
      clinicId,
      patientId: patient!.id,
      practitionerId: clinic.practitionerId,
      serviceId: clinic.serviceId,
      startsAt: localToUtc("2026-10-06", 10 * 60, tz),
      endsAt: localToUtc("2026-10-06", 10 * 60 + 30, tz),
      source: "voice",
      callId: testCall!.id,
      createdAt: NOW,
    });
    const mark = (test: boolean, at: Date) =>
      db.insert(auditEvents).values({
        clinicId,
        actorUserId: null,
        action: "call.marked_test",
        targetType: "call",
        targetId: testCall!.id,
        metadata: { test },
        createdAt: at,
      });
    const scope = scopeFor(clinic.ctx);

    await mark(true, new Date(NOW.getTime() - 60_000));
    expect(await isTestCall(db, clinicId, testCall!.id)).toBe(true);
    expect(await isTestCall(db, clinicId, realCall!.id)).toBe(false);

    const off = await todayOverview(db, scope, NOW, false);
    expect(off.stats).toMatchObject({ callsToday: 2, bookedByAssistantToday: 1 });
    const on = await todayOverview(db, scope, NOW, true);
    expect(on.stats).toMatchObject({ callsToday: 1, bookedByAssistantToday: 0 });

    await mark(false, new Date(NOW.getTime() - 30_000));
    expect(await isTestCall(db, clinicId, testCall!.id)).toBe(false);
    expect((await todayOverview(db, scope, NOW, true)).stats).toMatchObject({
      callsToday: 2,
      bookedByAssistantToday: 1,
    });
  });
});
