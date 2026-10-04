import type { Metadata } from "next";

import { can, requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { listPractitionerDetails, listServiceDetails } from "@/server/domain/settings";

import { PractitionersManager } from "./practitioners-manager";

export const metadata: Metadata = { title: "Hekimler" };

export default async function PractitionersPage() {
  const { clinic } = await requirePermission({ clinicSettings: ["read"] });
  const [practitioners, services, editable] = await Promise.all([
    listPractitionerDetails(db(), clinic.id),
    listServiceDetails(db(), clinic.id),
    can({ clinicSettings: ["update"] }),
  ]);
  return (
    <PractitionersManager
      practitioners={practitioners}
      services={services.map((s) => ({ id: s.id, name: s.name, isActive: s.isActive }))}
      editable={editable}
    />
  );
}
