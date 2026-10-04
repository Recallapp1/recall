import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { isBuiltInRole, ROLE_LABELS } from "@/lib/permissions";
import { findOpenInvitation } from "@/server/auth/accounts";
import { getSession } from "@/server/auth/session";

import { signOut } from "../../actions";
import { AuthHeading } from "../../_components/auth-ui";
import { AcceptAsMemberForm, NewAccountForm } from "./invitation-forms";

export const metadata: Metadata = { title: "Davet" };

export default async function InvitationPage({ params }: PageProps<"/davet/[id]">) {
  const { id } = await params;
  const [invitation, session] = await Promise.all([findOpenInvitation(id), getSession()]);

  if (!invitation) {
    return (
      <>
        <AuthHeading
          title="Davet geçersiz"
          description="Bu davetin süresi dolmuş, iptal edilmiş veya zaten kabul edilmiş olabilir. Kliniğinizin yöneticisinden yeni bir davet isteyin."
        />
        <Button asChild variant="outline" className="w-full">
          <Link href="/giris">Girişe dön</Link>
        </Button>
      </>
    );
  }

  const role = isBuiltInRole(invitation.role) ? ROLE_LABELS[invitation.role] : invitation.role;
  const heading = (
    <AuthHeading
      title={`${invitation.clinicName} ekibine katılın`}
      description={
        <>
          <strong className="font-medium text-heading">{invitation.email}</strong> adresine{" "}
          <strong className="font-medium text-heading">{role}</strong> rolüyle davet gönderildi.
        </>
      }
    />
  );

  if (session && session.user.email !== invitation.email) {
    return (
      <>
        {heading}
        <p className="mb-6 rounded-card-sm bg-canvas px-4 py-3 text-sm text-body">
          Şu an başka bir hesapla giriş yaptınız. Daveti kabul etmek için çıkış yapıp davetin
          gönderildiği adresle devam edin.
        </p>
        <form action={signOut}>
          <Button type="submit" variant="outline" className="w-full">
            Çıkış yap
          </Button>
        </form>
      </>
    );
  }

  if (session) {
    return (
      <>
        {heading}
        <AcceptAsMemberForm invitationId={invitation.id} />
      </>
    );
  }

  if (invitation.accountExists) {
    return (
      <>
        {heading}
        <p className="mb-6 text-sm text-body">
          Bu adresle bir Recall hesabınız var. Giriş yaptıktan sonra daveti kabul edebilirsiniz.
        </p>
        <Button asChild size="lg" className="w-full">
          <Link href={`/giris?sonra=${encodeURIComponent(`/davet/${invitation.id}`)}`}>
            Giriş yap
          </Link>
        </Button>
      </>
    );
  }

  return (
    <>
      {heading}
      <NewAccountForm invitationId={invitation.id} />
    </>
  );
}
