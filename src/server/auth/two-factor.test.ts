import { createHmac } from "node:crypto";

import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import { createTestDb } from "@/test/db";

/*
 * Two-step sign-in wiring (PANEL_TWO_FACTOR, 2FA step 2) against PGlite with
 * the real Better Auth: unset loads no plugin and signs in as today; with the
 * switch an enrolled user gets only the code step; switching off again lets
 * the same user in with the password alone.
 */

let testDb: Database;
vi.mock("../db", () => ({ db: () => testDb }));
let close: () => Promise<void>;
let modules: { auth: typeof import(".").auth; reset: typeof import(".").resetAuthForTests };

// Invented test account.
const ACCOUNT = { email: "iki-adim@klinik.test", password: "iki-adim-parola-123" };

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

const cookiesOf = (headers: Headers) =>
  headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

async function signIn() {
  return modules.auth().api.signInEmail({
    body: { email: ACCOUNT.email, password: ACCOUNT.password },
    returnHeaders: true,
  });
}

async function signInAudits(userId: string) {
  return testDb
    .select({ id: schema.auditEvents.id })
    .from(schema.auditEvents)
    .where(
      and(
        eq(schema.auditEvents.actorUserId, userId),
        eq(schema.auditEvents.action, "auth.sign_in"),
      ),
    );
}

function withSwitch(value: string | undefined) {
  vi.stubEnv("PANEL_TWO_FACTOR", value ?? "");
  if (value === undefined) delete process.env.PANEL_TWO_FACTOR;
  modules.reset();
}

let userId: string;

beforeAll(async () => {
  vi.stubEnv("APP_URL", "http://localhost:3000");
  vi.stubEnv("DATABASE_URL", "postgres://unused@localhost/unused");
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-test-secret-test-secret-123");
  vi.stubEnv("ACCOUNT.email_PROVIDER", "console");
  ({ db: testDb, close } = await createTestDb());
  const index = await import(".");
  modules = { auth: index.auth, reset: index.resetAuthForTests };
  const [user] = await testDb
    .insert(schema.users)
    .values({ name: "İki Adım", email: ACCOUNT.email, emailVerified: true })
    .returning();
  userId = user!.id;
  await testDb.insert(schema.accounts).values({
    userId,
    accountId: userId,
    providerId: "credential",
    password: await hashPassword(ACCOUNT.password),
  });
});

afterAll(async () => {
  vi.unstubAllEnvs();
  modules.reset();
  await close();
});

describe("PANEL_TWO_FACTOR (2FA step 2)", () => {
  it("unset: no plugin, sign-in gives a session and one sign-in audit, as today", async () => {
    withSwitch(undefined);
    expect(modules.auth().options.plugins?.some((p) => p.id === "two-factor")).toBe(false);
    const before = (await signInAudits(userId)).length;
    const result = await signIn();
    expect((result.response as { token?: string }).token).toBeTruthy();
    expect((result.response as { twoFactorRedirect?: boolean }).twoFactorRedirect).toBeUndefined();
    expect((await signInAudits(userId)).length).toBe(before + 1);
  });

  it("optional: an enrolled user gets only the code step; the real session is audited once", async () => {
    withSwitch("optional");
    expect(modules.auth().options.plugins?.some((p) => p.id === "two-factor")).toBe(true);
    const first = await signIn();
    const cookie = cookiesOf(first.headers);
    const enabled = await modules.auth().api.enableTwoFactor({
      body: { password: ACCOUNT.password },
      headers: new Headers({ cookie }),
    });
    if (enabled.method !== "totp") throw new Error("expected TOTP enrolment");
    expect(enabled.backupCodes).toHaveLength(10);
    const secret = new URL(enabled.totpURI).searchParams.get("secret")!;
    await modules
      .auth()
      .api.verifyTOTP({ body: { code: totp(secret) }, headers: new Headers({ cookie }) });

    const before = (await signInAudits(userId)).length;
    const second = await signIn();
    expect(second.response).toMatchObject({ twoFactorRedirect: true });
    expect(second.headers.getSetCookie().join(";")).not.toMatch(/session_token=[^;]+/);
    expect((await signInAudits(userId)).length).toBe(before);

    const challenge = cookiesOf(second.headers);
    const done = await modules.auth().api.verifyTOTP({
      body: { code: totp(secret) },
      headers: new Headers({ cookie: challenge }),
      returnHeaders: true,
    });
    expect(done.headers.getSetCookie().join(";")).toContain("session_token");
    expect((await signInAudits(userId)).length).toBe(before + 1);
  });

  it("switched off again: the enrolled user signs in with the password alone (rollback)", async () => {
    withSwitch("off");
    const result = await signIn();
    expect((result.response as { token?: string }).token).toBeTruthy();
    const [row] = await testDb
      .select({ enabled: schema.users.twoFactorEnabled })
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    // The enrolment is kept for when the switch comes back.
    expect(row!.enabled).toBe(true);
  });

  it("the plugin's HTTP endpoints stay closed", async () => {
    withSwitch("optional");
    const { POST } = await import("@/app/api/auth/[...all]/route");
    const response = await POST(
      new Request("http://localhost:3000/api/auth/two-factor/verify-totp", { method: "POST" }),
    );
    expect(response.status).toBe(404);
  });
});
