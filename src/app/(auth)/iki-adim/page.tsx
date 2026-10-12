import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireSession } from "@/server/auth/session";
import { isEnrolled, twoFactorPolicy } from "@/server/auth/two-factor";

import { AuthHeading } from "../_components/auth-ui";
import { requiredForMe } from "../two-factor-actions";
import { EnrolledActions, EnrolmentFlow } from "./two-factor-ui";

export const metadata: Metadata = { title: "İki adımlı giriş" };

/**
 * Two-step sign-in for the signed-in person (PANEL_TWO_FACTOR). Needs a
 * session but not 2FA, so people the policy sends here can always enrol.
 */
export default async function TwoFactorPage() {
  if (twoFactorPolicy() === "off") notFound();
  const session = await requireSession();
  const [enrolled, required] = await Promise.all([isEnrolled(session.user.id), requiredForMe()]);

  return (
    <>
      <AuthHeading
        title="İki adımlı giriş"
        description={
          enrolled
            ? "Açık: girişte parolanızdan sonra uygulamadaki kod istenir."
            : required
              ? "Rolünüz için zorunlu. Paneli kullanmadan önce kurun."
              : "Hesabınızı korumak için parolanın yanında telefonunuzdaki kodu isteyin."
        }
      />
      {enrolled ? <EnrolledActions canDisable={!required} /> : <EnrolmentFlow />}
    </>
  );
}
