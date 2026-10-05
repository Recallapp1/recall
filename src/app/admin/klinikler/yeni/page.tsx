import type { Metadata } from "next";

import { PageHeader } from "@/components/panel";
import { requirePlatformAdmin } from "@/server/auth/session";

import { NewClinicForm } from "./new-clinic-form";

export const metadata: Metadata = { title: "Yeni klinik" };

export default async function NewClinicPage() {
  await requirePlatformAdmin();
  return (
    <>
      <PageHeader
        title="Yeni klinik"
        description="Klinik, sektör şablonundaki hizmetler ve hafta içi 09:00–18:00 çalışma saatleriyle açılır; klinik sahibine parola belirleme e-postası gider."
      />
      <NewClinicForm />
    </>
  );
}
