import { createHmac } from "node:crypto";

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
import type { TestClinic } from "@/test/db";
import { createTestClinic } from "@/test/db";

/*
 * Two-step sign-in, screens' server side (2FA step 3): enrolment, recovery
 * codes, the policy gate, turning it off, the code step and the Recall reset,
 * through the real session and Better Auth (PGlite). PANEL_TWO_FACTOR is set
 * here only; it is unset everywhere else.
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

/** RFC 6238 code for a base32 secret, as an authenticator app computes it. */
function totp(base32: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of base32.replace(/=+$/, "").toUpperCase()) {
    bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  }
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const mac = createHmac("sha1", key).update(counter).digest();
  const offset = mac[mac.length - 1]! & 0xf;
  return String((mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

let close: () => Promise<void>;
let clinic: TestClinic;
let other: TestClinic;
const people = {} as Record<"owner" | "owner2" | "staff" | "recall" | "otherOwner", TestUser>;

const actions = () => import("./(auth)/two-factor-actions");
const audits = (userId: string, action: string) =>
  actionState.db
    .select()
    .from(schema.auditEvents)
    .where(and(eq(schema.auditEvents.targetId, userId), eq(schema.auditEvents.action, action)));
const enrolled = async (userId: string) =>
  (
    await actionState.db
      .select({ on: schema.users.twoFactorEnabled })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
  )[0]?.on === true;

const cookiesOf = (headers: Headers) =>
  headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");

/** Password step only: the pending challenge cookie, no session. */
async function challengeFor(user: TestUser): Promise<Headers> {
  const { auth } = await import("@/server/auth");
  const { headers, response } = await auth().api.signInEmail({
    body: { email: user.email, password: user.password! },
    returnHeaders: true,
  });
  expect(response).toMatchObject({ twoFactorRedirect: true });
  return new Headers({ cookie: cookiesOf(headers) });
}

/** Password and code, as the browser would do it: a fresh session for the user. */
async function signInWithCode(user: TestUser, secret: string): Promise<void> {
  const { auth } = await import("@/server/auth");
  const { headers } = await auth().api.verifyTOTP({
    body: { code: totp(secret) },
    headers: await challengeFor(user),
    returnHeaders: true,
  });
  user.headers = new Headers({ cookie: cookiesOf(headers) });
}

const secrets = new Map<string, string>();

async function enrol(user: TestUser) {
  actAs(user);
  const { startTwoFactorEnrolment, confirmTwoFactorEnrolment } = await actions();
  const started = await startTwoFactorEnrolment(user.password);
  if (!started.ok) throw new Error(started.message);
  await expect(confirmTwoFactorEnrolment(totp(started.secret))).rejects.toMatchObject({
    to: "/panel",
  });
  secrets.set(user.id, started.secret);
  // Turning it on replaces the session; sign in again with a code.
  await signInWithCode(user, started.secret);
  return started;
}

beforeAll(async () => {
  vi.stubEnv("APP_URL", "http://localhost:3000");
  vi.stubEnv("DATABASE_URL", "postgres://unused@localhost/unused");
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-test-secret-test-secret-123");
  vi.stubEnv("EMAIL_PROVIDER", "console");
  vi.stubEnv("PANEL_TWO_FACTOR", "optional");
  ({ close } = await setUpActionTests());
  clinic = await createTestClinic(actionState.db);
  other = await createTestClinic(actionState.db);
  people.owner = await createMember(clinic, "owner");
  people.owner2 = await createMember(clinic, "owner");
  people.staff = await createMember(clinic, "staff");
  people.otherOwner = await createMember(other, "owner");
  people.recall = await createPlatformAdmin(clinic);
}, 120_000);

afterAll(async () => {
  vi.unstubAllEnvs();
  await close();
});

describe("enrolment and recovery codes", () => {
  it("password, then the first code: on, audited, 10 recovery codes, a QR", async () => {
    const started = await enrol(people.owner);
    expect(started.qr).toContain("<svg");
    expect(started.backupCodes).toHaveLength(10);
    expect(await enrolled(people.owner.id)).toBe(true);
    const entries = await audits(people.owner.id, "auth.two_factor_enabled");
    expect(entries).toHaveLength(1);
    // Neither the secret nor a code reaches the audit log.
    expect(JSON.stringify(entries)).not.toContain(started.secret);
    expect(JSON.stringify(entries)).not.toContain(started.backupCodes[0]!);
  });

  it("refuses a wrong password, a wrong code and a second enrolment", async () => {
    actAs(people.staff);
    const { startTwoFactorEnrolment, confirmTwoFactorEnrolment } = await actions();
    expect(await startTwoFactorEnrolment("yanlis-parola-0000")).toEqual({
      ok: false,
      message: "Parola hatalı.",
    });
    const started = await startTwoFactorEnrolment(people.staff.password);
    expect(started.ok).toBe(true);
    expect((await confirmTwoFactorEnrolment("000000")).ok).toBe(false);
    expect(await enrolled(people.staff.id)).toBe(false);
    actAs(people.owner);
    expect(await startTwoFactorEnrolment(people.owner.password)).toEqual({
      ok: false,
      message: "İki adımlı giriş zaten açık.",
    });
  });

  it("new recovery codes replace the old set, with the password, audited", async () => {
    actAs(people.owner);
    const { regenerateRecoveryCodes } = await actions();
    expect((await regenerateRecoveryCodes("yanlis-parola-0000")).ok).toBe(false);
    const result = await regenerateRecoveryCodes(people.owner.password);
    if (!result.ok) throw new Error(result.message);
    expect(result.backupCodes).toHaveLength(10);
    expect(await audits(people.owner.id, "auth.two_factor_backup_codes_regenerated")).toHaveLength(
      1,
    );
  });
});

describe("policy gate", () => {
  it("required-admins: an owner without 2FA is sent to enrolment; staff and enrolled owners pass", async () => {
    vi.stubEnv("PANEL_TWO_FACTOR", "required-admins");
    onTestFinished(() => void vi.stubEnv("PANEL_TWO_FACTOR", "optional"));
    const { requireClinic } = await import("@/server/auth/session");
    actAs(people.owner2);
    await expect(requireClinic()).rejects.toMatchObject({ to: "/iki-adim" });
    actAs(people.staff);
    await expect(requireClinic()).resolves.toBeTruthy();
    actAs(people.owner);
    await expect(requireClinic()).resolves.toBeTruthy();
    const { requirePlatformAdmin } = await import("@/server/auth/session");
    actAs(people.recall);
    await expect(requirePlatformAdmin()).rejects.toMatchObject({ to: "/iki-adim" });
  });

  it("required-all sends unenrolled staff too; optional sends nobody", async () => {
    const { requireClinic } = await import("@/server/auth/session");
    vi.stubEnv("PANEL_TWO_FACTOR", "required-all");
    onTestFinished(() => void vi.stubEnv("PANEL_TWO_FACTOR", "optional"));
    actAs(people.staff);
    await expect(requireClinic()).rejects.toMatchObject({ to: "/iki-adim" });
    vi.stubEnv("PANEL_TWO_FACTOR", "optional");
    actAs(people.owner2);
    await expect(requireClinic()).resolves.toBeTruthy();
  });

  it("turning it off is refused where it is required, allowed where optional", async () => {
    const { disableTwoFactor } = await actions();
    vi.stubEnv("PANEL_TWO_FACTOR", "required-admins");
    onTestFinished(() => void vi.stubEnv("PANEL_TWO_FACTOR", "optional"));
    actAs(people.owner);
    expect(await disableTwoFactor(people.owner.password)).toEqual({
      ok: false,
      message: "Rolünüz için iki adımlı giriş zorunlu; kapatılamaz.",
    });
    vi.stubEnv("PANEL_TWO_FACTOR", "optional");
    await expect(disableTwoFactor(people.owner.password)).rejects.toMatchObject({ to: "/giris" });
    expect(await enrolled(people.owner.id)).toBe(false);
    expect(await audits(people.owner.id, "auth.two_factor_disabled")).toHaveLength(1);
  });
});

describe("the code step of sign-in", () => {
  let signedIn: TestUser;

  it("without a pending challenge, a code signs nobody in", async () => {
    actAs(null);
    const { verifySignInCode } = await actions();
    const result = await verifySignInCode({ code: "123456", recovery: false, next: "/panel" });
    expect(result.ok).toBe(false);
  });

  it("with the challenge: a wrong code is refused, the right one goes on to the panel", async () => {
    // A fresh person: the owner above turned it off, which ended their session.
    const user = (signedIn = await createMember(clinic, "staff"));
    await enrol(user);
    const { verifySignInCode } = await actions();
    actionState.headers = await challengeFor(user);
    expect((await verifySignInCode({ code: "000000", recovery: false })).ok).toBe(false);
    await expect(
      verifySignInCode({
        code: totp(secrets.get(user.id)!),
        recovery: false,
        next: "/panel/takvim",
      }),
    ).rejects.toMatchObject({ to: "/panel/takvim" });
    // An outside address is never a destination.
    actionState.headers = await challengeFor(user);
    await expect(
      verifySignInCode({
        code: totp(secrets.get(user.id)!),
        recovery: false,
        next: "https://example.com",
      }),
    ).rejects.toMatchObject({ to: "/panel/baslangic" });
  });

  it("a recovery code works once and is audited", async () => {
    const user = signedIn;
    actAs(user);
    const { regenerateRecoveryCodes, verifySignInCode } = await actions();
    const fresh = await regenerateRecoveryCodes(user.password);
    if (!fresh.ok) throw new Error(fresh.message);
    actionState.headers = await challengeFor(user);
    await expect(
      verifySignInCode({ code: fresh.backupCodes[0], recovery: true, next: "/panel" }),
    ).rejects.toMatchObject({ to: "/panel" });
    expect(await audits(user.id, "auth.two_factor_backup_code_used")).toHaveLength(1);
    actionState.headers = await challengeFor(user);
    expect((await verifySignInCode({ code: fresh.backupCodes[0], recovery: true })).ok).toBe(false);
  });
});

describe("Recall reset (owner's decision: Recall owner only, after a call-back)", () => {
  const reset = async (input: Record<string, unknown>) =>
    (await import("./admin/actions")).resetTwoFactorAction(input);

  it("refused unless the caller is the configured Recall owner and confirmed the call-back", async () => {
    const target = people.owner2;
    await enrol(target);
    actAs(people.recall);
    vi.stubEnv("TWO_FACTOR_RESET_EMAILS", "");
    const input = { clinicId: clinic.ctx.clinic.id, userId: target.id, calledBack: true };
    expect(await reset(input)).toEqual({
      ok: false,
      message: "Sıfırlama yalnızca Recall sahibine açık.",
    });
    vi.stubEnv("TWO_FACTOR_RESET_EMAILS", people.recall.email);
    onTestFinished(() => void vi.stubEnv("TWO_FACTOR_RESET_EMAILS", ""));
    expect((await reset({ ...input, calledBack: false })).ok).toBe(false);
    expect(
      await reset({ clinicId: other.ctx.clinic.id, userId: target.id, calledBack: true }),
    ).toEqual({
      ok: false,
      message: "Bu kişi bu kliniğin ekibinde değil.",
    });
    expect(await enrolled(target.id)).toBe(true);
  });

  it("the Recall owner resets: enrolment and every session gone, audited with the call-back", async () => {
    const target = people.owner2;
    vi.stubEnv("TWO_FACTOR_RESET_EMAILS", people.recall.email);
    onTestFinished(() => void vi.stubEnv("TWO_FACTOR_RESET_EMAILS", ""));
    actAs(people.recall);
    expect(
      await reset({ clinicId: clinic.ctx.clinic.id, userId: target.id, calledBack: true }),
    ).toMatchObject({ ok: true });
    expect(await enrolled(target.id)).toBe(false);
    const secrets = await actionState.db
      .select()
      .from(schema.twoFactors)
      .where(eq(schema.twoFactors.userId, target.id));
    expect(secrets).toHaveLength(0);
    const sessions = await actionState.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, target.id));
    expect(sessions).toHaveLength(0);
    const entries = await audits(target.id, "auth.two_factor_reset_by_recall");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.metadata).toEqual({ calledBackOnRegisteredNumber: true });
    expect(entries[0]!.actorUserId).toBe(people.recall.id);
  });

  it("clinic members cannot reach the reset", async () => {
    actAs(people.otherOwner);
    await expect(
      reset({ clinicId: other.ctx.clinic.id, userId: people.otherOwner.id, calledBack: true }),
    ).rejects.toBeInstanceOf(ForbiddenSignal);
  });
});
