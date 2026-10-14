"use server";

import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  acceptInvitationSchema,
  forgotPasswordSchema,
  safeNextPath,
  setPasswordSchema,
  signInSchema,
  type AcceptInvitationField,
  type SetPasswordField,
  type SignInField,
} from "@/lib/contracts/auth";
import { fieldErrors, type FormState } from "@/lib/contracts/form-state";
import { safeError } from "@/lib/safe-error";
import { auth } from "@/server/auth";
import { acceptInvitationAsNewUser } from "@/server/auth/accounts";
import { consoleClinicMembershipBlocked, PLATFORM_ADMIN } from "@/server/auth/platform";
import { requireSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { clinics, invitations } from "@/server/db/schema";
import { AuditWriteError, recordAudit } from "@/server/domain/audit";
import { DomainError } from "@/server/domain/errors";
import { allow, requestIp, TOO_MANY_ATTEMPTS } from "@/server/security/rate-limits";

const TRY_AGAIN = "Bir sorun oluştu. Lütfen biraz sonra tekrar deneyin.";

function logFailure(event: string, error: unknown) {
  console.error(JSON.stringify({ msg: event, error: safeError(error) }));
}

function tooManyAttempts(error: unknown): boolean {
  return error instanceof APIError && error.statusCode === 429;
}

export async function signIn(
  _previous: FormState<SignInField>,
  formData: FormData,
): Promise<FormState<SignInField>> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
    remember: formData.get("remember") === "on",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Lütfen alanları kontrol edin.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const ip = await requestIp();
  if (!(await allow("signInIp", [ip])) || !(await allow("signInEmail", [parsed.data.email]))) {
    return { status: "error", message: TOO_MANY_ATTEMPTS };
  }

  let secondStep = false;
  try {
    const result = await auth().api.signInEmail({
      body: {
        email: parsed.data.email,
        password: parsed.data.password,
        rememberMe: parsed.data.remember,
      },
      headers: await headers(),
    });
    // PANEL_TWO_FACTOR: an enrolled user gets no session yet, only the code step.
    secondStep = (result as { twoFactorRedirect?: boolean }).twoFactorRedirect === true;
  } catch (error) {
    if (tooManyAttempts(error)) {
      return {
        status: "error",
        message: "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.",
      };
    }
    if (error instanceof APIError) {
      // One message for unknown email and wrong password: no account enumeration.
      return { status: "error", message: "E-posta adresi veya parola hatalı." };
    }
    logFailure("auth.sign_in.failed", error);
    return { status: "error", message: TRY_AGAIN };
  }
  const next = safeNextPath(formData.get("sonra"));
  if (secondStep) redirect(`/giris/dogrulama?sonra=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function requestPasswordLink(
  _previous: FormState<"email">,
  formData: FormData,
): Promise<FormState<"email">> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") ?? "" });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Lütfen alanı kontrol edin.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }
  if (
    !(await allow("passwordResetIp", [await requestIp()])) ||
    !(await allow("passwordResetEmail", [parsed.data.email]))
  ) {
    return { status: "error", message: TOO_MANY_ATTEMPTS };
  }
  try {
    await auth().api.requestPasswordReset({ body: { email: parsed.data.email } });
  } catch (error) {
    if (tooManyAttempts(error)) {
      return {
        status: "error",
        message: "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.",
      };
    }
    logFailure("auth.password_link.failed", error);
  }
  // Same answer whether or not the address has an account.
  return {
    status: "success",
    message: "Bu adrese kayıtlı bir hesap varsa parola bağlantısını e-postayla gönderdik.",
  };
}

export async function setPassword(
  _previous: FormState<SetPasswordField>,
  formData: FormData,
): Promise<FormState<SetPasswordField>> {
  const parsed = setPasswordSchema.safeParse({
    token: formData.get("token") ?? "",
    password: formData.get("password") ?? "",
    passwordRepeat: formData.get("passwordRepeat") ?? "",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Lütfen alanları kontrol edin.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }
  if (!(await allow("setPasswordIp", [await requestIp()]))) {
    return { status: "error", message: TOO_MANY_ATTEMPTS };
  }
  try {
    await auth().api.resetPassword({
      body: { token: parsed.data.token, newPassword: parsed.data.password },
    });
  } catch (error) {
    if (error instanceof APIError) {
      return {
        status: "error",
        message: "Bağlantının süresi dolmuş veya daha önce kullanılmış. Yeni bir bağlantı isteyin.",
      };
    }
    logFailure("auth.set_password.failed", error);
    return { status: "error", message: TRY_AGAIN };
  }
  redirect("/giris?durum=parola");
}

/** New invitee: creates the account, accepts the invitation and signs in. */
export async function acceptInvitationWithNewAccount(
  _previous: FormState<AcceptInvitationField>,
  formData: FormData,
): Promise<FormState<AcceptInvitationField>> {
  const parsed = acceptInvitationSchema.safeParse({
    invitationId: formData.get("invitationId") ?? "",
    name: formData.get("name") ?? "",
    password: formData.get("password") ?? "",
    passwordRepeat: formData.get("passwordRepeat") ?? "",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Lütfen alanları kontrol edin.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  if (!(await allow("invitationIp", [await requestIp()]))) {
    return { status: "error", message: TOO_MANY_ATTEMPTS };
  }
  try {
    const { email } = await acceptInvitationAsNewUser(parsed.data);
    await auth().api.signInEmail({
      body: { email, password: parsed.data.password },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof DomainError) return { status: "error", message: error.userMessage };
    logFailure("auth.invitation_accept.failed", error);
    return { status: "error", message: TRY_AGAIN };
  }
  redirect("/panel");
}

/** Signed-in invitee: Better Auth checks the address and switches to the clinic. */
export async function acceptInvitationAsMember(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const invitationId = String(formData.get("invitationId") ?? "");
  const consoleUser = (session.user as { role?: string | null }).role === PLATFORM_ADMIN;
  if (consoleUser && consoleClinicMembershipBlocked()) {
    return {
      status: "error",
      message: "Recall konsol kullanıcıları kliniklerin ekibine katılamaz.",
    };
  }
  try {
    await auth().api.acceptInvitation({ body: { invitationId }, headers: await headers() });
    if (consoleUser) await auditConsoleUserJoined(session.user.id, invitationId);
  } catch (error) {
    if (error instanceof AuditWriteError) {
      return {
        status: "error",
        message:
          "Katıldınız ancak denetim kaydı yazılamadı. Recall ekibi bilgilendirildi; lütfen tekrar giriş yapın.",
      };
    }
    if (error instanceof APIError) {
      return {
        status: "error",
        message:
          error.statusCode === 403
            ? "Bu davet başka bir e-posta adresine gönderilmiş. O adresle giriş yapın."
            : "Davet geçersiz veya süresi dolmuş.",
      };
    }
    logFailure("auth.invitation_accept.failed", error);
    return { status: "error", message: TRY_AGAIN };
  }
  redirect("/panel");
}

/** A console user joined a clinic by invitation (FA-07): critical, after acceptance. */
async function auditConsoleUserJoined(userId: string, invitationId: string) {
  const [row] = await db()
    .select({ clinicId: clinics.id, role: invitations.role })
    .from(invitations)
    .innerJoin(clinics, eq(clinics.organizationId, invitations.organizationId))
    .where(eq(invitations.id, invitationId));
  await recordAudit(db(), {
    clinicId: row?.clinicId ?? null,
    actorUserId: userId,
    action: "platform.console_user_joined_clinic",
    targetType: "user",
    targetId: userId,
    metadata: { role: row?.role ?? null, via: "invitation" },
  });
}

export async function signOut() {
  try {
    await auth().api.signOut({ headers: await headers() });
  } catch (error) {
    logFailure("auth.sign_out.failed", error);
  }
  redirect("/giris");
}
