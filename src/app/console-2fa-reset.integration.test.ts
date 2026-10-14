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
 * Recall reset of a console user's two-step sign-in (owner's decision
 * 2026-10-14, full audit FA-06): Recall owner only (TWO_FACTOR_RESET_EMAILS),
 * identity verified out of band (mandatory tick), audited; console users
 * only, never oneself.
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
const people = {} as Record<"recallOwner" | "recallOther" | "clinicOwner", TestUser>;

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

const reset = async (input: Record<string, unknown>) =>
  (await import("./admin/actions")).resetConsoleUserTwoFactorAction(input);

beforeAll(async () => {
  vi.stubEnv("APP_URL", "http://localhost:3000");
  vi.stubEnv("DATABASE_URL", "postgres://unused@localhost/unused");
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-test-secret-test-secret-123");
  vi.stubEnv("EMAIL_PROVIDER", "console");
  vi.stubEnv("PANEL_TWO_FACTOR", "optional");
  ({ close } = await setUpActionTests());
  clinic = await createTestClinic(actionState.db);
  people.recallOwner = await createPlatformAdmin(clinic);
  people.recallOther = await createPlatformAdmin(clinic);
  people.clinicOwner = await createMember(clinic, "owner");
  await enrol(people.recallOther);
  await enrol(people.clinicOwner);
}, 120_000);

afterAll(async () => {
  vi.unstubAllEnvs();
  await close();
});

describe("Recall reset of a console user's two-step sign-in", () => {
  it("is refused unless the caller is the configured Recall owner", async () => {
    vi.stubEnv("TWO_FACTOR_RESET_EMAILS", "");
    actAs(people.recallOwner);
    expect(await reset({ userId: people.recallOther.id, verifiedOutOfBand: true })).toEqual({
      ok: false,
      message: "Sıfırlama yalnızca Recall sahibine açık.",
    });
    expect(await enrolled(people.recallOther.id)).toBe(true);
  });

  it("needs the out-of-band tick, a console user as target, and never oneself", async () => {
    vi.stubEnv("TWO_FACTOR_RESET_EMAILS", people.recallOwner.email);
    onTestFinished(() => void vi.stubEnv("TWO_FACTOR_RESET_EMAILS", ""));
    actAs(people.recallOwner);
    expect((await reset({ userId: people.recallOther.id, verifiedOutOfBand: false })).ok).toBe(
      false,
    );
    expect((await reset({ userId: people.recallOther.id })).ok).toBe(false);
    expect(await reset({ userId: people.clinicOwner.id, verifiedOutOfBand: true })).toEqual({
      ok: false,
      message: "Bu kişi Recall konsol kullanıcısı değil.",
    });
    expect(await reset({ userId: people.recallOwner.id, verifiedOutOfBand: true })).toEqual({
      ok: false,
      message: "Kendi iki adımlı girişinizi buradan sıfırlayamazsınız.",
    });
    expect(await enrolled(people.recallOther.id)).toBe(true);
    expect(await enrolled(people.clinicOwner.id)).toBe(true);
  });

  it("the Recall owner resets: enrolment and sessions gone, audited without a clinic", async () => {
    vi.stubEnv("TWO_FACTOR_RESET_EMAILS", people.recallOwner.email);
    onTestFinished(() => void vi.stubEnv("TWO_FACTOR_RESET_EMAILS", ""));
    actAs(people.recallOwner);
    expect(await reset({ userId: people.recallOther.id, verifiedOutOfBand: true })).toMatchObject({
      ok: true,
    });
    expect(await enrolled(people.recallOther.id)).toBe(false);
    const rows = await actionState.db
      .select()
      .from(schema.twoFactors)
      .where(eq(schema.twoFactors.userId, people.recallOther.id));
    expect(rows).toHaveLength(0);
    const sessions = await actionState.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, people.recallOther.id));
    expect(sessions).toHaveLength(0);
    const entries = await audits(people.recallOther.id, "auth.two_factor_reset_console_user");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      clinicId: null,
      actorUserId: people.recallOwner.id,
      metadata: { verifiedOutOfBand: true },
    });
  });

  it("clinic members cannot reach it", async () => {
    vi.stubEnv("TWO_FACTOR_RESET_EMAILS", people.clinicOwner.email);
    onTestFinished(() => void vi.stubEnv("TWO_FACTOR_RESET_EMAILS", ""));
    actAs(people.clinicOwner);
    await expect(
      reset({ userId: people.recallOther.id, verifiedOutOfBand: true }),
    ).rejects.toBeInstanceOf(ForbiddenSignal);
  });

  it("lists console users with their two-step state, and nobody else", async () => {
    const { listConsoleUsers } = await import("@/server/auth/two-factor");
    const list = await listConsoleUsers(actionState.db);
    const ids = list.map((user) => user.userId);
    expect(ids).toEqual(expect.arrayContaining([people.recallOwner.id, people.recallOther.id]));
    expect(ids).not.toContain(people.clinicOwner.id);
  });
});
