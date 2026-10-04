import type { Metadata } from "next";

import { AuthHeading } from "../_components/auth-ui";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Parolamı unuttum" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading
        title="Parolamı unuttum"
        description="Hesabınızın e-posta adresini yazın; parola belirleme bağlantısı gönderelim."
      />
      <ForgotPasswordForm />
    </>
  );
}
