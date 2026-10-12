import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { safeNextPath } from "@/lib/contracts/auth";
import { getSession } from "@/server/auth/session";
import { twoFactorPolicy } from "@/server/auth/two-factor";

import { AuthHeading } from "../../_components/auth-ui";
import { CodeForm } from "./code-form";

export const metadata: Metadata = { title: "Doğrulama kodu" };

/** Second step of sign-in (PANEL_TWO_FACTOR): the code from the authenticator app. */
export default async function VerifyPage({ searchParams }: PageProps<"/giris/dogrulama">) {
  if (twoFactorPolicy() === "off") notFound();
  const next = safeNextPath((await searchParams).sonra);
  if (await getSession()) redirect(next);
  // The password step leaves a short-lived challenge cookie; without it, start over.
  const challenge = (await cookies()).getAll().some((c) => c.name.endsWith("two_factor"));
  if (!challenge) redirect(`/giris?sonra=${encodeURIComponent(next)}`);

  return (
    <>
      <AuthHeading
        title="Doğrulama kodu"
        description="Kimlik doğrulama uygulamanızdaki 6 haneli kodu girin."
      />
      <CodeForm next={next} />
    </>
  );
}
