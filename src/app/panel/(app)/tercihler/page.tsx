import type { Metadata } from "next";

import { PageHeader } from "@/components/panel";
import { requireClinic } from "@/server/auth/session";
import { db } from "@/server/db";
import { loadClinicDirectory, practitionerDisplayName } from "@/server/domain/clinics";
import { getMemberPreferences } from "@/server/domain/preferences";

import { PreferencesForm } from "./preferences-form";

export const metadata: Metadata = { title: "Tercihlerim" };

export default async function PreferencesPage() {
  const { member, clinic, settings } = await requireClinic();
  const [preferences, directory] = await Promise.all([
    getMemberPreferences(db(), member.id),
    loadClinicDirectory(db(), clinic.id),
  ]);
  return (
    <>
      <PageHeader title="Tercihlerim" description="Yalnızca sizin panelinizi etkiler." />
      <PreferencesForm
        initial={preferences}
        clinicCalendarView={settings.panel.defaultCalendarView}
        practitioners={directory.practitioners.map((p) => ({
          id: p.id,
          name: practitionerDisplayName(p),
        }))}
        showPractitionerFilter={!member.practitionerId}
      />
    </>
  );
}
