import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestClinic, createTestDb } from "@/test/db";

import type { Database } from "../db";
import { calls } from "../db/schema";
import type { ClinicSettingsInput } from "./clinic-settings";
import { builtInRolesAllow } from "@/lib/permissions";

import { appointments, patients } from "../db/schema";
import { admitInboundCall, clinicUsage } from "./voice-limits";

// Wednesday 2026-10-07 12:00 Istanbul.
const NOW = new Date("2026-10-07T09:00:00Z");
const CALLER = "+905320000041";
const OTHER = "+905320000042";

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

function clinicWith(limits: NonNullable<ClinicSettingsInput["limits"]>) {
  return createTestClinic(db, { settings: { booking: { minNoticeMinutes: 0 }, limits } });
}

describe("admitInboundCall", () => {
  it("limits calls from one number per hour, without affecting other numbers", async () => {
    const { ctx } = await clinicWith({ callsPerNumberPerHour: 2 });
    expect(await admitInboundCall(db, ctx, CALLER, NOW)).toEqual({ admitted: true });
    expect(await admitInboundCall(db, ctx, CALLER, NOW)).toEqual({ admitted: true });
    expect(await admitInboundCall(db, ctx, CALLER, NOW)).toEqual({
      admitted: false,
      reason: "number_hourly",
    });
    expect(await admitInboundCall(db, ctx, OTHER, NOW)).toEqual({ admitted: true });
    // A new hour opens the number again.
    const later = new Date(NOW.getTime() + 61 * 60 * 1000);
    expect(await admitInboundCall(db, ctx, CALLER, later)).toEqual({ admitted: true });
  });

  it("limits a number per day across hours", async () => {
    const { ctx } = await clinicWith({ callsPerNumberPerHour: 5, callsPerNumberPerDay: 2 });
    await admitInboundCall(db, ctx, CALLER, NOW);
    await admitInboundCall(db, ctx, CALLER, new Date(NOW.getTime() + 2 * 3600_000));
    expect(await admitInboundCall(db, ctx, CALLER, new Date(NOW.getTime() + 4 * 3600_000))).toEqual(
      { admitted: false, reason: "number_daily" },
    );
  });

  it("gives withheld numbers one shared budget", async () => {
    const { ctx } = await clinicWith({ hiddenCallsPerHour: 1 });
    expect(await admitInboundCall(db, ctx, null, NOW)).toEqual({ admitted: true });
    expect(await admitInboundCall(db, ctx, null, NOW)).toEqual({
      admitted: false,
      reason: "hidden_hourly",
    });
    expect(await admitInboundCall(db, ctx, CALLER, NOW)).toEqual({ admitted: true });
  });

  it("caps all calls to the clinic per hour", async () => {
    const { ctx } = await clinicWith({ callsPerHour: 2 });
    await admitInboundCall(db, ctx, CALLER, NOW);
    await admitInboundCall(db, ctx, OTHER, NOW);
    expect(await admitInboundCall(db, ctx, "+905320000043", NOW)).toEqual({
      admitted: false,
      reason: "clinic_hourly",
    });
  });

  it("declines calls once today's voice minutes are used up; yesterday does not count", async () => {
    const { ctx } = await clinicWith({ dailyVoiceMinutes: 10 });
    const yesterday = new Date(NOW.getTime() - 24 * 3600_000);
    await db.insert(calls).values([
      {
        clinicId: ctx.clinic.id,
        provider: "retell",
        providerCallId: `minutes-old-${ctx.clinic.id}`,
        startedAt: yesterday,
        durationSeconds: 3600,
      },
      {
        clinicId: ctx.clinic.id,
        provider: "retell",
        providerCallId: `minutes-a-${ctx.clinic.id}`,
        startedAt: new Date(NOW.getTime() - 3600_000),
        durationSeconds: 300,
      },
    ]);
    expect(await admitInboundCall(db, ctx, CALLER, NOW)).toEqual({ admitted: true });

    await db.insert(calls).values({
      clinicId: ctx.clinic.id,
      provider: "retell",
      providerCallId: `minutes-b-${ctx.clinic.id}`,
      startedAt: new Date(NOW.getTime() - 1800_000),
      durationSeconds: 300,
    });
    expect(await admitInboundCall(db, ctx, OTHER, NOW)).toEqual({
      admitted: false,
      reason: "daily_minutes",
    });
  });
});

describe("clinicUsage (A8)", () => {
  it("counts today's minutes, calls and assistant bookings in the clinic's day", async () => {
    const { ctx, serviceId, practitionerId } = await clinicWith({});
    const clinicId = ctx.clinic.id;
    await db.insert(calls).values([
      {
        clinicId,
        provider: "retell",
        providerCallId: `use-a-${clinicId}`,
        startedAt: new Date(NOW.getTime() - 30 * 60_000),
        createdAt: new Date(NOW.getTime() - 30 * 60_000),
        durationSeconds: 90,
      },
      {
        clinicId,
        provider: "retell",
        providerCallId: `use-b-${clinicId}`,
        startedAt: new Date(NOW.getTime() - 3 * 3600_000),
        createdAt: new Date(NOW.getTime() - 3 * 3600_000),
        durationSeconds: 30,
      },
      {
        clinicId,
        provider: "retell",
        providerCallId: `use-old-${clinicId}`,
        startedAt: new Date(NOW.getTime() - 26 * 3600_000),
        createdAt: new Date(NOW.getTime() - 26 * 3600_000),
        durationSeconds: 600,
      },
    ]);
    const [patient] = await db
      .insert(patients)
      .values({ clinicId, fullName: "Kullanım Hasta", phone: "+905320000044" })
      .returning();
    await db.insert(appointments).values({
      clinicId,
      patientId: patient!.id,
      practitionerId,
      serviceId,
      startsAt: new Date("2026-10-08T07:00:00Z"),
      endsAt: new Date("2026-10-08T07:30:00Z"),
      source: "voice",
      createdAt: new Date(NOW.getTime() - 60_000),
    });
    expect(await clinicUsage(db, ctx, NOW)).toEqual({
      voiceMinutesToday: 2,
      callsToday: 2,
      callsLastHour: 1,
      voiceBookingsToday: 1,
    });
  });

  it("is visible to owners and admins only (billing.read); editing stays with Recall", () => {
    expect(builtInRolesAllow("owner", { billing: ["read"] })).toBe(true);
    expect(builtInRolesAllow("admin", { billing: ["read"] })).toBe(true);
    expect(builtInRolesAllow("staff", { billing: ["read"] })).toBe(false);
    expect(builtInRolesAllow("practitioner", { billing: ["read"] })).toBe(false);
  });
});
