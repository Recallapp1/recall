import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import type { EmailMessage } from "@/server/notifications/email";
import { createTestClinic, createTestDb } from "@/test/db";

/*
 * Account flows against PGlite with the real Better Auth instance: Recall team
 * provisioning, password setup, invitations and role limits (F3.6).
 */

let testDb: Database;
vi.mock("../db", () => ({ db: () => testDb }));

const sent: EmailMessage[] = [];
let close: () => Promise<void>;
let modules: {
  auth: typeof import(".").auth;
  accounts: typeof import("./accounts");
};

beforeAll(async () => {
  vi.stubEnv("APP_URL", "http://localhost:3000");
  vi.stubEnv("DATABASE_URL", "postgres://unused@localhost/unused");
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-test-secret-test-secret-123");
  vi.stubEnv("EMAIL_PROVIDER", "console");
  ({ db: testDb, close } = await createTestDb());

  const email = await import("../notifications/email");
  email.setEmailProvider({ send: async (message) => void sent.push(message) });
  modules = { auth: (await import(".")).auth, accounts: await import("./accounts") };
  // Migrations plus Better Auth's first import are slow when the suite runs in parallel.
}, 30_000);

afterAll(async () => {
  vi.unstubAllEnvs();
  await close();
});

function lastLink(pattern: RegExp): string {
  const text = sent.at(-1)?.text ?? "";
  const match = text.match(pattern);
  if (!match?.[1]) throw new Error(`No link matching ${pattern} in last email`);
  return match[1];
}

/** Signs in and returns request headers carrying the session cookie. */
async function signIn(email: string, password: string): Promise<Headers> {
  const { headers } = await modules.auth().api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  });
  const cookie = headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}

const OWNER = { email: "sahip@klinik.test", password: "sahip-parola-123" };

describe("account provisioning", () => {
  let clinicId: string;

  it("adds an owner who sets a password from the emailed link and signs in", async () => {
    clinicId = (await createTestClinic(testDb)).ctx.clinic.id;
    const result = await modules.accounts.addClinicMember({
      clinicId,
      email: " Sahip@Klinik.TEST ",
      name: "Klinik Sahibi",
      role: "owner",
    });
    expect(result).toMatchObject({
      userCreated: true,
      memberCreated: true,
      passwordEmailSent: true,
    });
    expect(sent.at(-1)?.subject).toContain("parolanızı belirleyin");

    const token = lastLink(/sifre-belirle\?token=([\w-]+)/);
    await modules.auth().api.resetPassword({ body: { token, newPassword: OWNER.password } });

    const headers = await signIn(OWNER.email, OWNER.password);
    const session = await modules.auth().api.getSession({ headers });
    expect(session?.user.email).toBe(OWNER.email);
    expect(session?.user.emailVerified).toBe(true);

    const [clinic] = await testDb
      .select({ organizationId: schema.clinics.organizationId })
      .from(schema.clinics)
      .where(eq(schema.clinics.id, clinicId));
    expect(session?.session.activeOrganizationId).toBe(clinic?.organizationId);
  });

  it("is idempotent for an existing member", async () => {
    const before = sent.length;
    const result = await modules.accounts.addClinicMember({
      clinicId,
      email: OWNER.email,
      name: "Klinik Sahibi",
      role: "owner",
    });
    expect(result).toMatchObject({
      userCreated: false,
      memberCreated: false,
      passwordEmailSent: false,
    });
    expect(sent.length).toBe(before);
  });

  it("audits the addition and the sign-in", async () => {
    const events = await testDb
      .select({ action: schema.auditEvents.action, metadata: schema.auditEvents.metadata })
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.clinicId, clinicId));
    const actions = events.map((event) => event.action);
    expect(actions).toContain("team.member_added");
    expect(actions).toContain("auth.sign_in");
    // No personal data in audit metadata.
    expect(JSON.stringify(events)).not.toContain("klinik.test");
  });

  it("keeps public sign-up closed", async () => {
    await expect(
      modules.auth().api.signUpEmail({
        body: { email: "yabanci@ornek.test", password: "yabanci-parola-1", name: "Yabancı" },
      }),
    ).rejects.toThrow();
  });

  it("invites a new staff member who creates an account from the invitation", async () => {
    const ownerHeaders = await signIn(OWNER.email, OWNER.password);
    await modules.auth().api.createInvitation({
      body: { email: "sekreter@klinik.test", role: "staff" },
      headers: ownerHeaders,
    });
    const invitationId = lastLink(/davet\/([0-9a-f-]{36})/);
    expect(sent.at(-1)?.text).toContain("Sekreter");

    const view = await modules.accounts.findOpenInvitation(invitationId);
    expect(view).toMatchObject({
      email: "sekreter@klinik.test",
      role: "staff",
      accountExists: false,
    });

    await modules.accounts.acceptInvitationAsNewUser({
      invitationId,
      name: "Ayşe Sekreter",
      password: "sekreter-parola-1",
    });
    expect(await modules.accounts.findOpenInvitation(invitationId)).toBeNull();

    const staffHeaders = await signIn("sekreter@klinik.test", "sekreter-parola-1");
    const staffSession = await modules.auth().api.getSession({ headers: staffHeaders });
    expect(staffSession?.session.activeOrganizationId).toBeTruthy();

    // Staff cannot invite (F3.2 matrix).
    await expect(
      modules.auth().api.createInvitation({
        body: { email: "baska@klinik.test", role: "staff" },
        headers: staffHeaders,
      }),
    ).rejects.toThrow();
  });

  it("rejects a reused invitation", async () => {
    const [accepted] = await testDb
      .select({ id: schema.invitations.id })
      .from(schema.invitations)
      .where(eq(schema.invitations.status, "accepted"));
    await expect(
      modules.accounts.acceptInvitationAsNewUser({
        invitationId: accepted!.id,
        name: "Tekrar",
        password: "tekrar-parola-12",
      }),
    ).rejects.toMatchObject({ code: "INVITATION_INVALID" });
  });

  it("does not let a member switch into a clinic they do not belong to", async () => {
    const other = await createTestClinic(testDb);
    const otherOrg = await modules.accounts.ensureClinicOrganization(other.ctx.clinic.id);
    const ownerHeaders = await signIn(OWNER.email, OWNER.password);
    await expect(
      modules.auth().api.setActiveOrganization({
        body: { organizationId: otherOrg },
        headers: ownerHeaders,
      }),
    ).rejects.toThrow();
  });

  it("makes a platform admin who can list users but never impersonate", async () => {
    const { ensurePlatformAdmin } = await import("../platform/admins");
    await ensurePlatformAdmin({ email: "konsol@recall.test", name: "Recall Ekibi" });
    const token = lastLink(/sifre-belirle\?token=([\w-]+)/);
    await modules.auth().api.resetPassword({ body: { token, newPassword: "konsol-parola-123" } });
    const headers = await signIn("konsol@recall.test", "konsol-parola-123");

    const listed = await modules.auth().api.listUsers({ query: {}, headers });
    expect(listed.users.length).toBeGreaterThan(0);

    const [owner] = await testDb
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, OWNER.email));
    await expect(
      modules.auth().api.impersonateUser({ body: { userId: owner!.id }, headers }),
    ).rejects.toThrow();

    // Clinic owners are not platform admins.
    const ownerHeaders = await signIn(OWNER.email, OWNER.password);
    await expect(
      modules.auth().api.listUsers({ query: {}, headers: ownerHeaders }),
    ).rejects.toThrow();
  });
});
