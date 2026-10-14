import "server-only";

import { asc, eq } from "drizzle-orm";

import { env, type Env } from "@/lib/env";
import { memberRoles } from "@/lib/permissions";

import { db, type Executor } from "../db";
import { sessions, twoFactors, users } from "../db/schema";
import { PLATFORM_ADMIN } from "./platform";

/**
 * Two-step sign-in policy (PANEL_TWO_FACTOR, docs/proposals/2FA-TOTP).
 * Owner's decision 2026-10-12: required-admins before the pilot, other staff
 * optional first, then required-all after a month without issues.
 */
export type TwoFactorPolicy = Env["PANEL_TWO_FACTOR"];

export function twoFactorPolicy(): TwoFactorPolicy {
  try {
    return env().PANEL_TWO_FACTOR;
  } catch {
    // Without a valid environment (some unit tests) the default applies.
    return "off";
  }
}

/** Whether this person must have two-step sign-in under the policy. */
export function mustUseTwoFactor(
  policy: TwoFactorPolicy,
  who: { memberRole?: string | null; platformRole?: string | null },
): boolean {
  if (policy === "off" || policy === "optional") return false;
  if (policy === "required-all") return true;
  return (
    who.platformRole === PLATFORM_ADMIN ||
    memberRoles(who.memberRole ?? "").some((role) => role === "owner" || role === "admin")
  );
}

export async function isEnrolled(userId: string): Promise<boolean> {
  const [row] = await db()
    .select({ enabled: users.twoFactorEnabled })
    .from(users)
    .where(eq(users.id, userId));
  return row?.enabled === true;
}

/** Where people who must enrol are sent; it needs a session, not 2FA. */
export const ENROLMENT_PATH = "/iki-adim";

/**
 * Called by the panel and console guards: true when this person must enrol
 * before using anything else. Off and optional never block; the database is
 * read only under a required policy.
 */
export async function enrolmentRequired(
  userId: string,
  who: { memberRole?: string | null; platformRole?: string | null },
  policy: TwoFactorPolicy = twoFactorPolicy(),
): Promise<boolean> {
  if (!mustUseTwoFactor(policy, who)) return false;
  return !(await isEnrolled(userId));
}

/**
 * Who at Recall may reset someone's two-step sign-in: the Recall owner only
 * (owner's decision), named by e-mail in TWO_FACTOR_RESET_EMAILS. Unset: nobody.
 */
export function mayResetTwoFactor(email: string, configured: string | undefined): boolean {
  const allowed = (configured ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}

/** Recall console users (platform admins) with their two-step state, for the console. */
export async function listConsoleUsers(exec: Executor) {
  return exec
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      twoFactorEnabled: users.twoFactorEnabled,
    })
    .from(users)
    .where(eq(users.role, PLATFORM_ADMIN))
    .orderBy(asc(users.name));
}

/**
 * Recall reset for a lost phone and lost recovery codes: removes the
 * enrolment and ends every session of the user, who enrols again at the next
 * sign-in (when the policy requires it). Callers audit it in the same transaction.
 */
export async function resetTwoFactor(exec: Executor, userId: string): Promise<boolean> {
  await exec.delete(twoFactors).where(eq(twoFactors.userId, userId));
  const [user] = await exec
    .update(users)
    .set({ twoFactorEnabled: false })
    .where(eq(users.id, userId))
    .returning({ id: users.id });
  await exec.delete(sessions).where(eq(sessions.userId, userId));
  return Boolean(user);
}
