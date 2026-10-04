import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/contracts/auth";
import { getSession } from "@/server/auth/session";

import { AuthHeading } from "../_components/auth-ui";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Giriş yap" };

export default async function SignInPage({ searchParams }: PageProps<"/giris">) {
  const params = await searchParams;
  const next = safeNextPath(params.sonra);
  if (await getSession()) redirect(next);

  return (
    <>
      <AuthHeading
        title="Giriş yap"
        description="Klinik panelinize e-posta adresiniz ve parolanızla girin."
      />
      <SignInForm next={next} passwordChanged={params.durum === "parola"} />
    </>
  );
}
