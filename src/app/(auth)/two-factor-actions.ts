"use server";

import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { renderSVG } from "uqr";
import { z } from "zod";

import { safeNextPath } from "@/lib/contracts/auth";
import { safeError } from "@/lib/safe-error";
import { auth } from "@/server/auth";
import { requireSession } from "@/server/auth/session";
import { isEnrolled, mustUseTwoFactor, twoFactorPolicy } from "@/server/auth/two-factor";
import { db } from "@/server/db";
import { clinics, members } from "@/server/db/schema";
import { recordAudit, type AuditAction } from "@/server/domain/audit";
import { allow, requestIp, TOO_MANY_ATTEMPTS } from "@/server/security/rate-limits";

/*
 * Two-step sign-in (PANEL_TWO_FACTOR, docs/proposals/2FA-TOTP). Every step
 * runs here through auth().api, like the rest of sign-in: the plugin's own
 * HTTP endpoints stay closed. Secrets and codes are never logged or audited.
 */

type Result<T = object> = ({ ok: true } & T) | { ok: false; message: string };

const TRY_AGAIN = "Bir sorun oluştu. Lütfen biraz sonra tekrar deneyin.";
const WRONG_CODE = "Kod geçersiz veya süresi doldu. Uygulamadaki güncel kodu girin.";
const WRONG_PASSWORD = "Parola hatalı.";
const passwordSchema = z.string().min(1).max(200);
const codeSchema = z
  .string()
  .transform((value) => value.replace(/\s+/g, ""))
  .pipe(z.string().min(6).max(20));

function isOff(): boolean {
  return twoFactorPolicy() === "off";
}

function failure(event: string, error: unknown, message: string) {
  if (error instanceof APIError) return { ok: false as const, message };
  console.error(JSON.stringify({ msg: event, error: safeError(error) }));
  return { ok: false as const, message: TRY_AGAIN };
}

/** The clinic the entry belongs to: the active clinic, else the user's first one. */
async function auditClinicId(userId: string, organizationId?: string | null) {
  const [row] = await db()
    .select({ id: clinics.id })
    .from(members)
    .innerJoin(clinics, eq(clinics.organizationId, members.organizationId))
    .where(organizationId ? eq(members.organizationId, organizationId) : eq(members.userId, userId))
    .limit(1);
  return row?.id ?? null;
}

async function audit(action: AuditAction, userId: string, organizationId?: string | null) {
  await recordAudit(db(), {
    clinicId: await auditClinicId(userId, organizationId),
    actorUserId: userId,
    action,
    targetType: "user",
    targetId: userId,
  });
}

/** QR for the authenticator app; its colour comes from the page (DESIGN.md tokens). */
function qrSvg(uri: string): string {
  return renderSVG(uri, { blackColor: "currentColor", whiteColor: "transparent", border: 0 });
}

/** Step 1: the password again, then a new secret (not active until confirmed). */
export async function startTwoFactorEnrolment(
  password: unknown,
): Promise<Result<{ qr: string; secret: string; backupCodes: string[] }>> {
  const session = await requireSession();
  if (isOff()) return { ok: false, message: "Bu özellik kapalı." };
  if (await isEnrolled(session.user.id)) {
    return { ok: false, message: "İki adımlı giriş zaten açık." };
  }
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { ok: false, message: "Parolanızı girin." };
  if (!(await allow("twoFactorUser", [session.user.id]))) {
    return { ok: false, message: TOO_MANY_ATTEMPTS };
  }
  try {
    const result = await auth().api.enableTwoFactor({
      body: { password: parsed.data },
      headers: await headers(),
    });
    if (result.method !== "totp") return { ok: false, message: TRY_AGAIN };
    const secret = new URL(result.totpURI).searchParams.get("secret") ?? "";
    return { ok: true, qr: qrSvg(result.totpURI), secret, backupCodes: result.backupCodes };
  } catch (error) {
    return failure("auth.two_factor_start.failed", error, WRONG_PASSWORD);
  }
}

/**
 * Step 2: the first code from the app turns two-step sign-in on. Better Auth
 * replaces the session here, so this redirects (carrying the new cookie)
 * instead of letting the page re-render with the old one.
 */
export async function confirmTwoFactorEnrolment(
  code: unknown,
): Promise<{ ok: false; message: string }> {
  const session = await requireSession();
  if (isOff()) return { ok: false, message: "Bu özellik kapalı." };
  const parsed = codeSchema.safeParse(code);
  if (!parsed.success) return { ok: false, message: WRONG_CODE };
  if (!(await allow("twoFactorUser", [session.user.id]))) {
    return { ok: false, message: TOO_MANY_ATTEMPTS };
  }
  try {
    await auth().api.verifyTOTP({ body: { code: parsed.data }, headers: await headers() });
  } catch (error) {
    return failure("auth.two_factor_confirm.failed", error, WRONG_CODE);
  }
  await audit("auth.two_factor_enabled", session.user.id, session.session.activeOrganizationId);
  redirect("/panel");
}

/** New recovery codes (the password again); the old set stops working. */
export async function regenerateRecoveryCodes(
  password: unknown,
): Promise<Result<{ backupCodes: string[] }>> {
  const session = await requireSession();
  if (isOff()) return { ok: false, message: "Bu özellik kapalı." };
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { ok: false, message: "Parolanızı girin." };
  if (!(await allow("twoFactorUser", [session.user.id]))) {
    return { ok: false, message: TOO_MANY_ATTEMPTS };
  }
  try {
    const result = await auth().api.generateBackupCodes({
      body: { password: parsed.data },
      headers: await headers(),
    });
    await audit(
      "auth.two_factor_backup_codes_regenerated",
      session.user.id,
      session.session.activeOrganizationId,
    );
    return { ok: true, backupCodes: result.backupCodes };
  } catch (error) {
    return failure("auth.two_factor_codes.failed", error, WRONG_PASSWORD);
  }
}

/** Whether the policy requires two-step sign-in for this user in any of their clinics. */
export async function requiredForMe(): Promise<boolean> {
  const session = await requireSession();
  const policy = twoFactorPolicy();
  const platformRole = (session.user as { role?: string | null }).role ?? null;
  const memberships = await db()
    .select({ role: members.role })
    .from(members)
    .where(eq(members.userId, session.user.id));
  return (
    mustUseTwoFactor(policy, { platformRole }) ||
    memberships.some((row) => mustUseTwoFactor(policy, { memberRole: row.role, platformRole }))
  );
}

/** Turning it off: only when the policy does not require it for this person. */
export async function disableTwoFactor(password: unknown): Promise<Result> {
  const session = await requireSession();
  if (isOff()) return { ok: false, message: "Bu özellik kapalı." };
  if (await requiredForMe()) {
    return { ok: false, message: "Rolünüz için iki adımlı giriş zorunlu; kapatılamaz." };
  }
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { ok: false, message: "Parolanızı girin." };
  try {
    await auth().api.disableTwoFactor({
      body: { password: parsed.data },
      headers: await headers(),
    });
  } catch (error) {
    return failure("auth.two_factor_disable.failed", error, WRONG_PASSWORD);
  }
  await audit("auth.two_factor_disabled", session.user.id, session.session.activeOrganizationId);
  // Better Auth ends the session when 2FA is turned off.
  redirect("/giris");
}

/**
 * The code step of sign-in (`/giris/dogrulama`). One neutral message per
 * kind of failure; limits per address, and Better Auth locks the challenge.
 */
export async function verifySignInCode(input: unknown): Promise<{ ok: false; message: string }> {
  const parsed = z
    .object({ code: codeSchema, recovery: z.boolean(), next: z.string().nullish() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: WRONG_CODE };
  if (!(await allow("twoFactorIp", [await requestIp()]))) {
    return { ok: false, message: TOO_MANY_ATTEMPTS };
  }
  let userId: string | null = null;
  try {
    const result = parsed.data.recovery
      ? await auth().api.verifyBackupCode({
          body: { code: parsed.data.code },
          headers: await headers(),
        })
      : await auth().api.verifyTOTP({ body: { code: parsed.data.code }, headers: await headers() });
    userId = (result as { user?: { id?: string } }).user?.id ?? null;
  } catch (error) {
    return failure(
      "auth.two_factor_verify.failed",
      error,
      parsed.data.recovery ? "Yedek kod geçersiz veya daha önce kullanılmış." : WRONG_CODE,
    );
  }
  if (parsed.data.recovery && userId) await audit("auth.two_factor_backup_code_used", userId);
  redirect(safeNextPath(parsed.data.next ?? null));
}
