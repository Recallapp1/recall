import { CalendarClock } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState, PageHeader } from "@/components/panel";
import { requirePermission } from "@/server/auth/session";

export const metadata: Metadata = { title: "Bugün" };

export default async function TodayPage() {
  const { session } = await requirePermission({ appointments: ["read"] });
  const firstName = session.user.name.split(" ")[0];

  return (
    <>
      <PageHeader title={`Merhaba, ${firstName}`} description="Kliniğinizin bugünkü özeti" />
      <EmptyState
        icon={CalendarClock}
        title="Günlük özet hazırlanıyor"
        description="Randevular, aramalar ve geri arama talepleri burada görünecek."
      />
    </>
  );
}
