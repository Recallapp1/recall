import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, onTestFinished, vi } from "vitest";

import * as schema from "@/server/db/schema";
import { parseClinicSettings } from "@/server/domain/clinic-settings";
import {
  actAs,
  actionState,
  createMember,
  createPlatformAdmin,
  ForbiddenSignal,
  NotFoundSignal,
  RedirectSignal,
  setUpActionTests,
  type TestUser,
} from "@/test/actions";
import { createTestClinic, type TestClinic } from "@/test/db";

/*
 * Console: clinic limits (CONSOLE_LIMITS_EDIT, full audit FA-09). Without the
 * switch the action refuses and changes nothing (limits stay a database-only
 * setting, as today).
 */

vi.mock("@/server/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db")>()),
  db: () => actionState.db,
}));
vi.mock("next/headers", () => ({
  headers: async () => actionState.headers,
  cookies: async () => ({
    get: () => undefined,
    getAll: () => [],
    set: () => {},
    delete: () => {},
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new RedirectSignal(to);
  },
  forbidden: () => {
    throw new ForbiddenSignal();
  },
  notFound: () => {
    throw new NotFoundSignal();
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
// The assistant sync runs after the response and needs Retell: not here.
vi.mock("@/server/voice/sync", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/voice/sync")>()),
  scheduleAssistantSync: () => {},
}));

let close: () => Promise<void>;
let clinic: TestClinic;
let owner: TestUser;
let recall: TestUser;

const limits = {
  callsPerNumberPerHour: 6,
  callsPerNumberPerDay: 20,
  hiddenCallsPerHour: 12,
  callsPerHour: 80,
  dailyVoiceMinutes: 600,
  maxCallMinutes: 12,
  bookingsPerCall: 2,
  bookingsPerNumberPerDay: 4,
};

const save = async (input: unknown) =>
  (await import("./admin/actions")).setClinicLimitsAction(input);

async function storedLimits() {
  const [row] = await actionState.db
    .select({ settings: schema.clinics.settings })
    .from(schema.clinics)
    .where(eq(schema.clinics.id, clinic.ctx.clinic.id));
  return parseClinicSettings(row!.settings).limits;
}

beforeAll(async () => {
  vi.stubEnv("APP_URL", "http://localhost:3000");
  vi.stubEnv("DATABASE_URL", "postgres://unused@localhost/unused");
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-test-secret-test-secret-123");
  vi.stubEnv("EMAIL_PROVIDER", "console");
  ({ close } = await setUpActionTests());
  clinic = await createTestClinic(actionState.db);
  owner = await createMember(clinic, "owner");
  recall = await createPlatformAdmin(clinic);
}, 120_000);

afterAll(async () => {
  vi.unstubAllEnvs();
  await close();
});

describe("console clinic limits", () => {
  it("is refused while CONSOLE_LIMITS_EDIT is unset, and changes nothing", async () => {
    vi.stubEnv("CONSOLE_LIMITS_EDIT", "");
    actAs(recall);
    const before = await storedLimits();
    expect(await save({ clinicId: clinic.ctx.clinic.id, limits })).toEqual({
      ok: false,
      message: "Bu özellik kapalı.",
    });
    expect(await storedLimits()).toEqual(before);
  });

  it("with the switch: a console user saves validated limits, audited with the changed fields", async () => {
    vi.stubEnv("CONSOLE_LIMITS_EDIT", "true");
    onTestFinished(() => void vi.stubEnv("CONSOLE_LIMITS_EDIT", ""));
    actAs(recall);
    expect(await save({ clinicId: clinic.ctx.clinic.id, limits })).toMatchObject({ ok: true });
    expect(await storedLimits()).toEqual(limits);

    const audits = await actionState.db
      .select()
      .from(schema.auditEvents)
      .where(
        and(
          eq(schema.auditEvents.clinicId, clinic.ctx.clinic.id),
          eq(schema.auditEvents.action, "platform.limits_changed"),
        ),
      );
    expect(audits).toHaveLength(1);
    expect(audits[0]!.actorUserId).toBe(recall.id);
    expect(audits[0]!.metadata).toMatchObject({
      fields: expect.arrayContaining(["dailyVoiceMinutes", "callsPerHour"]),
    });
  });

  it("with the switch: out-of-range values are refused in Turkish and change nothing", async () => {
    vi.stubEnv("CONSOLE_LIMITS_EDIT", "true");
    onTestFinished(() => void vi.stubEnv("CONSOLE_LIMITS_EDIT", ""));
    actAs(recall);
    const before = await storedLimits();
    const result = await save({
      clinicId: clinic.ctx.clinic.id,
      limits: { ...limits, dailyVoiceMinutes: 5 },
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("Günlük ses dakikası");
    expect(await storedLimits()).toEqual(before);
  });

  it("clinic members cannot reach it, even the owner", async () => {
    vi.stubEnv("CONSOLE_LIMITS_EDIT", "true");
    onTestFinished(() => void vi.stubEnv("CONSOLE_LIMITS_EDIT", ""));
    actAs(owner);
    await expect(save({ clinicId: clinic.ctx.clinic.id, limits })).rejects.toBeInstanceOf(
      ForbiddenSignal,
    );
  });

  it("other settings survive a limits change", async () => {
    vi.stubEnv("CONSOLE_LIMITS_EDIT", "true");
    onTestFinished(() => void vi.stubEnv("CONSOLE_LIMITS_EDIT", ""));
    const [row] = await actionState.db
      .select({ settings: schema.clinics.settings })
      .from(schema.clinics)
      .where(eq(schema.clinics.id, clinic.ctx.clinic.id));
    const before = parseClinicSettings(row!.settings);
    actAs(recall);
    await save({ clinicId: clinic.ctx.clinic.id, limits: { ...limits, bookingsPerCall: 3 } });
    const [after] = await actionState.db
      .select({ settings: schema.clinics.settings })
      .from(schema.clinics)
      .where(eq(schema.clinics.id, clinic.ctx.clinic.id));
    const parsed = parseClinicSettings(after!.settings);
    expect(parsed.booking).toEqual(before.booking);
    expect(parsed.assistant).toEqual(before.assistant);
    expect(parsed.limits.bookingsPerCall).toBe(3);
  });
});
