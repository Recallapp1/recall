import type { Metadata } from "next";

import { can, requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { loadWeeklyHours } from "@/server/domain/settings";

import { ClinicHoursForm } from "./clinic-hours-form";

export const metadata: Metadata = { title: "Çalışma saatleri" };

export default async function ClinicHoursPage() {
  const { clinic } = await requirePermission({ clinicSettings: ["read"] });
  const [hours, editable] = await Promise.all([
    loadWeeklyHours(db(), clinic.id, null),
    can({ clinicSettings: ["update"] }),
  ]);
  return <ClinicHoursForm initial={hours} editable={editable} />;
}
