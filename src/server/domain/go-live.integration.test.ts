import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { builtInRolesAllow } from "@/lib/permissions";
import { createTestClinic, createTestDb } from "@/test/db";

import type { Database } from "../db";
import { providerDeletions } from "../db/schema";
import { goLiveChecks } from "./go-live";

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

  it("is for owners and admins only (billing.read)", () => {
    expect(builtInRolesAllow("owner", { billing: ["read"] })).toBe(true);
    expect(builtInRolesAllow("admin", { billing: ["read"] })).toBe(true);
    expect(builtInRolesAllow("staff", { billing: ["read"] })).toBe(false);
    expect(builtInRolesAllow("practitioner", { billing: ["read"] })).toBe(false);
  });
});
