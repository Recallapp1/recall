import { Building2 } from "lucide-react";
import type { Metadata } from "next";

import { Logo } from "@/components/design";
import { EmptyState } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { listMemberships } from "@/server/auth/accounts";
import { requireSession } from "@/server/auth/session";

import { signOut } from "../../(auth)/actions";
import { switchClinic } from "../actions";

export const metadata: Metadata = { title: "Klinik seçin", robots: { index: false } };

/** Reached when the session has no (valid) active clinic. */
export default async function ChooseClinicPage() {
  const session = await requireSession();
  const memberships = await listMemberships(session.user.id);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-canvas px-4 py-12">
      <Logo className="text-heading" />
      <div className="flex w-full max-w-md flex-col gap-4">
        {memberships.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Henüz bir kliniğe üye değilsiniz"
            description="Kliniğinizin yöneticisinden davet isteyin. Davet e-postasındaki bağlantıyla ekibe katılabilirsiniz."
            action={
              <form action={signOut}>
                <Button variant="outline" type="submit">
                  Çıkış yap
                </Button>
              </form>
            }
          />
        ) : (
          <div className="rounded-bento border border-hairline bg-paper p-6">
            <h1 className="mb-4 text-xl font-semibold text-heading">Klinik seçin</h1>
            <ul className="flex flex-col gap-2">
              {memberships.map((membership) => (
                <li key={membership.organizationId}>
                  <form action={switchClinic.bind(null, membership.organizationId)}>
                    <Button type="submit" variant="outline" className="w-full justify-start">
                      <Building2 />
                      {membership.clinicName}
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
