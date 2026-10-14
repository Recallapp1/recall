import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { builtInRolesAllow } from "@/lib/permissions";
import { createTestClinic, createTestDb } from "@/test/db";

import type { Database } from "../db";
import { providerDeletions } from "../db/schema";
import { goLiveChecks } from "./go-live";
import { runHourlyReminders } from "./notifications";

/* R2 5c: the read-only go-live check (PANEL_GO_LIVE_CHECK). */

const OFF = {
  SMS_SENDING_ENABLED: false,
  SMS_PROVIDER: "console" as const,
  POST_CALL_FLAGS: undefined,
  VOICE_TOOL_IDEMPOTENCY: undefined,
  VOICE_TOOL_FAILSAFE: undefined,
  AUDIT_STRICT: undefined,
  VOICE_SHARED_NUMBER_CHECK: undefined,
  PATIENTS_PER_NAME: undefined,
  PANEL_PATIENT_EDIT: undefined,
  VOICE_PROMPT_HARDENING: undefined,
  DELETION_QUEUE_HOURLY: undefined,
  HOURLY_REMINDERS: undefined,
  CALL_REVIEW: undefined,
  TEST_CALL_FLAG: undefined,
  PANEL_LIMITS_VIEW: undefined,
  RECORDING_OFF_SWEEP: undefined,
};

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

describe("goLiveChecks (R2 5c)", () => {
  it("a configured clinic is ready, SMS shows as off, every switch off", async () => {
    const clinic = await createTestClinic(db);
    const { checks, switches } = await goLiveChecks(db, clinic.ctx.clinic.id, OFF);
    const state = Object.fromEntries(checks.map((c) => [c.label, c.state]));
    expect(state).toEqual({
      "Klinik durumu": "ok",
      "Telefon hattı": "ok",
      Asistan: "ok",
      "Çalışma saatleri, hekim ve hizmet": "ok",
      SMS: "off",
      "Recall konsol kullanıcıları": "ok",
      "Silme kuyruğu (KVKK)": "ok",
    });
    expect(switches.every((s) => !s.on)).toBe(true);
  });

  it("shows a pending KVKK deletion and the switches that are on, for this clinic only", async () => {
    const clinic = await createTestClinic(db);
    const other = await createTestClinic(db);
    await db.insert(providerDeletions).values({
      clinicId: other.ctx.clinic.id,
      provider: "retell",
      providerCallId: "golive-other",
      reason: "patient_anonymized",
    });
    await db.insert(providerDeletions).values({
      clinicId: clinic.ctx.clinic.id,
      provider: "retell",
      providerCallId: "golive-own",
      reason: "patient_anonymized",
    });
    const { checks, switches } = await goLiveChecks(db, clinic.ctx.clinic.id, {
      ...OFF,
      POST_CALL_FLAGS: true,
      SMS_SENDING_ENABLED: true,
      SMS_PROVIDER: "netgsm",
    });
    expect(checks.find((c) => c.label === "Silme kuyruğu (KVKK)")).toMatchObject({
      state: "warn",
      detail: "1 kayıt sağlayıcıda silinmeyi bekliyor",
    });
    expect(checks.find((c) => c.label === "SMS")?.state).toBe("ok");
    expect(switches.find((s) => s.label === "Arama işaretleri")?.on).toBe(true);
  });

  it("HOURLY_REMINDERS on: warns until the hourly job has run, then ok; unset shows no such row", async () => {
    const clinic = await createTestClinic(db);
    const label = "Saatlik hatırlatmalar";
    const off = await goLiveChecks(db, clinic.ctx.clinic.id, OFF);
    expect(off.checks.map((c) => c.label)).not.toContain(label);

    const now = new Date();
    const on = await goLiveChecks(db, clinic.ctx.clinic.id, { ...OFF, HOURLY_REMINDERS: true });
    expect(on.checks.find((c) => c.label === label)).toMatchObject({ state: "warn" });

    await runHourlyReminders(db, {
      now,
      sendingEnabled: false,
      provider: { delivers: false, send: async () => {} },
      providerName: "test",
    });
    const after = await goLiveChecks(db, clinic.ctx.clinic.id, { ...OFF, HOURLY_REMINDERS: true });
    expect(after.checks.find((c) => c.label === label)).toMatchObject({ state: "ok" });
  });

  it("shows the two-step sign-in policy and the session length", async () => {
    const clinic = await createTestClinic(db);
    const { switches } = await goLiveChecks(db, clinic.ctx.clinic.id, {
      ...OFF,
      PANEL_TWO_FACTOR: "required-admins",
      PANEL_SESSION_HOURS: 12,
    });
    expect(switches).toContainEqual({ label: "İki adımlı giriş: required-admins", on: true });
    expect(switches).toContainEqual({ label: "Panel oturum süresi: 12 saat", on: true });
    const unset = await goLiveChecks(db, clinic.ctx.clinic.id, OFF);
    expect(unset.switches).toContainEqual({ label: "İki adımlı giriş: kapalı", on: false });
    expect(unset.switches).toContainEqual({ label: "Panel oturum süresi: 7 gün", on: false });
  });

  it("is for owners and admins only (billing.read)", () => {
    expect(builtInRolesAllow("owner", { billing: ["read"] })).toBe(true);
    expect(builtInRolesAllow("admin", { billing: ["read"] })).toBe(true);
    expect(builtInRolesAllow("staff", { billing: ["read"] })).toBe(false);
    expect(builtInRolesAllow("practitioner", { billing: ["read"] })).toBe(false);
  });
});
