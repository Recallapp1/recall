"use server";

import { APIError } from "better-auth/api";
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
import { requireSession } from "@/server/auth/session";
import { DomainError } from "@/server/domain/errors";

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

  try {
    await auth().api.signInEmail({
      body: {
        email: parsed.data.email,
        password: parsed.data.password,
        rememberMe: parsed.data.remember,
      },
      headers: await headers(),
    });
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
  redirect(safeNextPath(formData.get("sonra")));
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
  await requireSession();
  const invitationId = String(formData.get("invitationId") ?? "");
  try {
    await auth().api.acceptInvitation({ body: { invitationId }, headers: await headers() });
  } catch (error) {
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

export async function signOut() {
  try {
    await auth().api.signOut({ headers: await headers() });
  } catch (error) {
    logFailure("auth.sign_out.failed", error);
  }
  redirect("/giris");
}
