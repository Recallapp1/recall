import type { Metadata } from "next";
import Link from "next/link";

import { AuthHeading } from "../_components/auth-ui";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Parola belirle" };

export default async function SetPasswordPage({ searchParams }: PageProps<"/sifre-belirle">) {
  const { token } = await searchParams;

  if (typeof token !== "string" || !token) {
    return (
      <>
        <AuthHeading
          title="Bağlantı geçersiz"
          description="Parola bağlantısı eksik veya hatalı. Yeni bir bağlantı isteyebilirsiniz."
        />
        <Link href="/sifremi-unuttum" className="text-sm font-medium text-primary hover:underline">
          Yeni bağlantı iste
        </Link>
      </>
    );
  }

  return (
    <>
      <AuthHeading
        title="Parolanızı belirleyin"
        description="En az 10 karakter. Tahmin edilmesi zor, başka yerde kullanmadığınız bir parola seçin."
      />
      <SetPasswordForm token={token} />
    </>
  );
}
