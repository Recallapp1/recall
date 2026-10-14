import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, onTestFinished, vi } from "vitest";

import * as schema from "@/server/db/schema";
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
 * A Recall console user joining a clinic (owner's decision 2026-10-14, full
 * audit FA-07): always a critical audit entry; refused only with the optional
 * BLOCK_CONSOLE_CLINIC_MEMBERSHIP switch (off by default).
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

const JOINED = "platform.console_user_joined_clinic";

async function joinedAudits(userId: string) {
  return actionState.db
    .select()
    .from(schema.auditEvents)
    .where(and(eq(schema.auditEvents.action, JOINED), eq(schema.auditEvents.targetId, userId)));
}

async function isMember(userId: string, target: TestClinic) {
  const rows = await actionState.db
    .select({ id: schema.members.id })
    .from(schema.members)
    .innerJoin(schema.clinics, eq(schema.clinics.organizationId, schema.members.organizationId))
    .where(and(eq(schema.members.userId, userId), eq(schema.clinics.id, target.ctx.clinic.id)));
  return rows.length > 0;
}

beforeAll(async () => {
  vi.stubEnv("APP_URL", "http://localhost:3000");
  vi.stubEnv("DATABASE_URL", "postgres://unused@localhost/unused");
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-test-secret-test-secret-123");
  vi.stubEnv("EMAIL_PROVIDER", "console");
  ({ close } = await setUpActionTests());
  clinic = await createTestClinic(actionState.db);
  owner = await createMember(clinic, "owner");
}, 120_000);

afterAll(async () => {
  vi.unstubAllEnvs();
  await close();
});

const addFromConsole = async (actor: TestUser, target: TestClinic, email: string) => {
  actAs(actor);
  return (await import("./admin/actions")).addClinicMemberAction({
    clinicId: target.ctx.clinic.id,
    name: "Konsol Kişi",
    email,
    role: "admin",
  });
};

describe("console user added to a clinic from the console", () => {
  it("unset switch: allowed, with a critical audit entry in that clinic", async () => {
    const target = await createTestClinic(actionState.db);
    const recall = await createPlatformAdmin(clinic);
    expect(await addFromConsole(recall, target, recall.email)).toMatchObject({ ok: true });
    expect(await isMember(recall.id, target)).toBe(true);
    const entries = await joinedAudits(recall.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      clinicId: target.ctx.clinic.id,
      metadata: { via: "recall_team" },
    });
    const { isCriticalAudit } = await import("@/server/domain/audit");
    expect(isCriticalAudit(JOINED, false)).toBe(true);
  });

  it("an ordinary person added from the console leaves no such entry", async () => {
    const target = await createTestClinic(actionState.db);
    const recall = await createPlatformAdmin(clinic);
    await addFromConsole(recall, target, "siradan-kisi@klinik.test");
    const all = await actionState.db
      .select()
      .from(schema.auditEvents)
      .where(
        and(
          eq(schema.auditEvents.action, JOINED),
          eq(schema.auditEvents.clinicId, target.ctx.clinic.id),
        ),
      );
    expect(all).toHaveLength(0);
  });

  it("BLOCK_CONSOLE_CLINIC_MEMBERSHIP=true: refused, no membership, no entry", async () => {
    vi.stubEnv("BLOCK_CONSOLE_CLINIC_MEMBERSHIP", "true");
    onTestFinished(() => void vi.stubEnv("BLOCK_CONSOLE_CLINIC_MEMBERSHIP", ""));
    const target = await createTestClinic(actionState.db);
    const recall = await createPlatformAdmin(clinic);
    expect(await addFromConsole(recall, target, recall.email)).toEqual({
      ok: false,
      message: "Recall konsol kullanıcıları kliniklerin ekibine eklenemez.",
    });
    expect(await isMember(recall.id, target)).toBe(false);
    expect(await joinedAudits(recall.id)).toHaveLength(0);
  });
});

describe("console user accepting an invitation", () => {
  async function invite(email: string) {
    actAs(owner);
    const result = await (
      await import("./panel/(app)/ayarlar/ekip/actions")
    ).inviteMember({ email, role: "staff" });
    expect(result).toMatchObject({ ok: true });
    const [invitation] = await actionState.db
      .select({ id: schema.invitations.id })
      .from(schema.invitations)
      .where(and(eq(schema.invitations.email, email), eq(schema.invitations.status, "pending")));
    return invitation!.id;
  }

  async function accept(user: TestUser, invitationId: string) {
    actAs(user);
    const form = new FormData();
    form.set("invitationId", invitationId);
    return (await import("./(auth)/actions")).acceptInvitationAsMember(
      { status: "idle" } as never,
      form,
    );
  }

  it("unset switch: accepted, with a critical audit entry", async () => {
    const recall = await createPlatformAdmin(clinic);
    const id = await invite(recall.email);
    await expect(accept(recall, id)).rejects.toMatchObject({ to: "/panel" });
    expect(await isMember(recall.id, clinic)).toBe(true);
    const entries = await joinedAudits(recall.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      clinicId: clinic.ctx.clinic.id,
      metadata: { via: "invitation" },
    });
  });

  it("BLOCK_CONSOLE_CLINIC_MEMBERSHIP=true: refused, not a member", async () => {
    vi.stubEnv("BLOCK_CONSOLE_CLINIC_MEMBERSHIP", "true");
    onTestFinished(() => void vi.stubEnv("BLOCK_CONSOLE_CLINIC_MEMBERSHIP", ""));
    const recall = await createPlatformAdmin(clinic);
    const id = await invite(recall.email);
    expect(await accept(recall, id)).toEqual({
      status: "error",
      message: "Recall konsol kullanıcıları kliniklerin ekibine katılamaz.",
    });
    expect(await isMember(recall.id, clinic)).toBe(false);
  });
});

describe("granting the console role to a clinic member", () => {
  it("unset switch: granted, one critical entry per clinic the person belongs to", async () => {
    const member = await createMember(clinic, "staff");
    const { ensurePlatformAdmin } = await import("@/server/platform/admins");
    await ensurePlatformAdmin({ email: member.email, name: "Kişi" });
    const entries = await joinedAudits(member.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      clinicId: clinic.ctx.clinic.id,
      metadata: { via: "console_role_granted" },
    });
  });

  it("BLOCK_CONSOLE_CLINIC_MEMBERSHIP=true: refused for a clinic member, role unchanged", async () => {
    vi.stubEnv("BLOCK_CONSOLE_CLINIC_MEMBERSHIP", "true");
    onTestFinished(() => void vi.stubEnv("BLOCK_CONSOLE_CLINIC_MEMBERSHIP", ""));
    const member = await createMember(clinic, "staff");
    const { ensurePlatformAdmin } = await import("@/server/platform/admins");
    await expect(ensurePlatformAdmin({ email: member.email, name: "Kişi" })).rejects.toMatchObject({
      code: "CONSOLE_USER_IN_CLINIC",
    });
    const [row] = await actionState.db
      .select({ role: schema.users.role })
      .from(schema.users)
      .where(eq(schema.users.id, member.id));
    expect(row!.role).not.toBe("platform_admin");
  });
});

describe("go-live page row", () => {
  it("warns while a console user is on the clinic's team", async () => {
    const { goLiveChecks } = await import("@/server/domain/go-live");
    const { env } = await import("@/lib/env");
    const target = await createTestClinic(actionState.db);
    const label = "Recall konsol kullanıcıları";
    const before = await goLiveChecks(actionState.db, target.ctx.clinic.id, env());
    expect(before.checks.find((c) => c.label === label)).toMatchObject({ state: "ok" });
    const recall = await createPlatformAdmin(clinic);
    await addFromConsole(recall, target, recall.email);
    const after = await goLiveChecks(actionState.db, target.ctx.clinic.id, env());
    expect(after.checks.find((c) => c.label === label)).toMatchObject({ state: "warn" });
  });
});
