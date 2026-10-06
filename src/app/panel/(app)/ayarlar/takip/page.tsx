import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CLINIC_TEMPLATES, CLINIC_TEMPLATE_KEYS } from "@/lib/clinic-templates";
import { can, requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { loadClinicDirectory } from "@/server/domain/clinics";
import { listRules } from "@/server/domain/follow-ups";

import { FollowUpRules, FollowUpSettingsCard } from "./rules-editor";

export const metadata: Metadata = { title: "Takip kuralları" };

export default async function FollowUpRulesPage() {
  const context = await requirePermission({ clinicSettings: ["read"] });
  if (!context.settings.features.followUp) notFound();
  const [rules, directory, editable] = await Promise.all([
    listRules(db(), context.clinic.id),
    loadClinicDirectory(db(), context.clinic.id),
    can({ clinicSettings: ["update"] }),
  ]);

  return (
    <>
      <FollowUpRules
        editable={editable}
        rules={rules.map((rule) => ({ ...rule, openPlans: Number(rule.openPlans) }))}
        services={directory.services.map((s) => ({ id: s.id, name: s.name }))}
        templates={CLINIC_TEMPLATE_KEYS.map((key) => ({
          key,
          label: CLINIC_TEMPLATES[key].label,
        }))}
      />
      <FollowUpSettingsCard
        editable={editable}
        initial={{
          smsReminders: context.settings.followUp.smsReminders,
          dueSoonDays: context.settings.followUp.dueSoonDays,
        }}
      />
    </>
  );
}
