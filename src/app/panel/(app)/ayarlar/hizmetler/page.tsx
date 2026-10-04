import type { Metadata } from "next";

import { can, requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { listServiceDetails } from "@/server/domain/settings";

import { ServicesManager } from "./services-manager";

export const metadata: Metadata = { title: "Hizmetler" };

export default async function ServicesPage() {
  const { clinic, settings } = await requirePermission({ clinicSettings: ["read"] });
  const [services, editable] = await Promise.all([
    listServiceDetails(db(), clinic.id),
    can({ clinicSettings: ["update"] }),
  ]);
  return (
    <ServicesManager
      speakPrices={settings.assistant.speakPrices}
      editable={editable}
      services={services.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        aliases: s.aliases,
        durationMinutes: s.durationMinutes,
        priceMin: s.priceMin,
        priceMax: s.priceMax,
        isActive: s.isActive,
      }))}
    />
  );
}
