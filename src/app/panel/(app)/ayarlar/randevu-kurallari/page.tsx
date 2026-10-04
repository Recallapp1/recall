import type { Metadata } from "next";

import { can, requirePermission } from "@/server/auth/session";

import { BookingRulesForm } from "./booking-rules-form";

export const metadata: Metadata = { title: "Randevu kuralları" };

export default async function BookingRulesPage() {
  const { settings } = await requirePermission({ clinicSettings: ["read"] });
  const editable = await can({ clinicSettings: ["update"] });
  return (
    <BookingRulesForm
      editable={editable}
      initial={{ ...settings.booking, ...settings.notifications }}
    />
  );
}
