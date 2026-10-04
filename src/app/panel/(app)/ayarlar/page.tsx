import type { Metadata } from "next";

import { can, requirePermission } from "@/server/auth/session";

import { ClinicProfileForm } from "./clinic-profile-form";
import { PanelPreferencesForm } from "./panel-preferences-form";

export const metadata: Metadata = { title: "Ayarlar" };

export default async function ClinicSettingsPage() {
  const { clinic, settings } = await requirePermission({ clinicSettings: ["read"] });
  const editable = await can({ clinicSettings: ["update"] });
  return (
    <>
      <ClinicProfileForm
        editable={editable}
        initial={{
          name: clinic.name,
          address: clinic.address ?? "",
          transferPhoneNumber: clinic.transferPhoneNumber ?? "",
        }}
        timeZone={clinic.timezone}
      />
      <PanelPreferencesForm editable={editable} initial={settings.panel} />
    </>
  );
}
