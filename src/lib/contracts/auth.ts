import { z } from "zod";

/** Shared by the sign-in, password and invitation forms and their server actions. */

export const PASSWORD_MIN_LENGTH = 10;

const email = z.string().trim().toLowerCase().pipe(z.email("Geçerli bir e-posta adresi yazın."));

const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Parola en az ${PASSWORD_MIN_LENGTH} karakter olmalı.`)
  .max(128, "Parola en fazla 128 karakter olabilir.");

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Parolanızı yazın."),
  remember: z.boolean().default(false),
});
export type SignInField = keyof z.input<typeof signInSchema>;

export const forgotPasswordSchema = z.object({ email });

const passwordPair = {
  password: newPassword,
  passwordRepeat: z.string(),
};
const passwordsMatch = (value: { password: string; passwordRepeat: string }) =>
  value.password === value.passwordRepeat;
const mismatch = { message: "Parolalar aynı değil.", path: ["passwordRepeat"] };

export const setPasswordSchema = z
  .object({ token: z.string().min(1, "Bağlantı geçersiz."), ...passwordPair })
  .refine(passwordsMatch, mismatch);
export type SetPasswordField = keyof z.input<typeof setPasswordSchema>;

export const acceptInvitationSchema = z
  .object({
    invitationId: z.uuid("Davet geçersiz."),
    name: z.string().trim().min(2, "Adınızı ve soyadınızı yazın.").max(100),
    ...passwordPair,
  })
  .refine(passwordsMatch, mismatch);
export type AcceptInvitationField = keyof z.input<typeof acceptInvitationSchema>;

/**
 * Where to go after signing in. Only same-site paths are allowed, so a crafted
 * `?sonra=https://…` or `//evil.example` link cannot redirect off the site.
 */
export function safeNextPath(value: unknown, fallback = "/panel/baslangic"): string {
  if (typeof value !== "string") return fallback;
  // Browsers drop tabs and line breaks and read "\" as "/", so "/\t/evil.com"
  // would become "//evil.com": allow visible characters only, no backslash.
  if (!/^\/[^\s\\]*$/.test(value) || value.startsWith("//")) return fallback;
  // Resolved against a placeholder origin, the target must stay on it.
  const resolved = new URL(value, "https://recall.invalid");
  if (resolved.origin !== "https://recall.invalid") return fallback;
  return resolved.pathname + resolved.search + resolved.hash;
}
