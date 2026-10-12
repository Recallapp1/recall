import { eq } from "drizzle-orm";

import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import type { EmailMessage } from "@/server/notifications/email";

import { createTestClinic, createTestDb, type TestClinic } from "./db";

/**
 * Server-action tests against PGlite with the real Better Auth, the real
 * session, membership and permission checks. Only the request scope (headers),
 * navigation, cache revalidation, `after()` and the voice platform are stubbed;
 * the test file wires those stubs to `actionState` with vi.mock.
 */

export class RedirectSignal extends Error {
  constructor(readonly to: string) {
    super(`redirect:${to}`);
  }
}
export class ForbiddenSignal extends Error {
  constructor() {
    super("forbidden");
  }
}
export class NotFoundSignal extends Error {
  constructor() {
    super("not-found");
  }
}

export const actionState = {
  db: undefined as unknown as Database,
  headers: new Headers(),
  after: [] as Array<() => unknown>,
  emails: [] as EmailMessage[],
};

export interface TestUser {
  id: string;
  email: string;
  headers: Headers;
  /** The invented test password (two-step sign-in needs it again). */
  password?: string;
}

let counter = 0;

export async function setUpActionTests(): Promise<{ close: () => Promise<void> }> {
  const { db, close } = await createTestDb();
  actionState.db = db;
  const email = await import("@/server/notifications/email");
  email.setEmailProvider({ send: async (message) => void actionState.emails.push(message) });
  return { close };
}

/** Acts as this user (or anonymously) for the next action calls. */
export function actAs(user: TestUser | null): void {
  actionState.headers = new Headers(user?.headers ?? {});
  actionState.headers.set("x-real-ip", `203.0.113.${(counter % 200) + 1}`);
}

async function signIn(email: string, password: string): Promise<Headers> {
  const { auth } = await import("@/server/auth");
  const { headers } = await auth().api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  });
  const cookie = headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}

/** A clinic member with a password, signed in (the clinic becomes their active one). */
export async function createMember(clinic: TestClinic, role: string): Promise<TestUser> {
  counter += 1;
  const email = `${role}-${counter}@klinik.test`;
  const password = `parola-${counter}-uzun-bir-parola`;
  const { addClinicMember } = await import("@/server/auth/accounts");
  await addClinicMember({
    clinicId: clinic.ctx.clinic.id,
    email,
    name: `Test ${role}`,
    role: role as Parameters<typeof addClinicMember>[0]["role"],
  });
  const text = actionState.emails.at(-1)?.text ?? "";
  const token = text.match(/sifre-belirle\?token=([\w-]+)/)?.[1];
  if (!token) throw new Error("No password link e-mailed");
  const { auth } = await import("@/server/auth");
  await auth().api.resetPassword({ body: { token, newPassword: password } });
  const [user] = await actionState.db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email));
  return { id: user!.id, email, password, headers: await signIn(email, password) };
}

/** A Recall console user (platform admin) who is not a member of any clinic. */
export async function createPlatformAdmin(anyClinic: TestClinic): Promise<TestUser> {
  const user = await createMember(anyClinic, "admin");
  await actionState.db.delete(schema.members).where(eq(schema.members.userId, user.id));
  await actionState.db
    .update(schema.users)
    .set({ role: "platform_admin" })
    .where(eq(schema.users.id, user.id));
  return user;
}

export { createTestClinic };
