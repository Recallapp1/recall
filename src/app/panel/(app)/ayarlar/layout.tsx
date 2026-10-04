import { PageHeader } from "@/components/panel";
import type { Permissions } from "@/lib/permissions";
import { can, requirePermission } from "@/server/auth/session";

import { SettingsNav } from "./settings-nav";

const SECTIONS: { href: string; label: string; permission: Permissions }[] = [
  { href: "/panel/ayarlar", label: "Klinik", permission: { clinicSettings: ["read"] } },
  {
    href: "/panel/ayarlar/calisma-saatleri",
    label: "Çalışma saatleri",
    permission: { clinicSettings: ["read"] },
  },
  { href: "/panel/ayarlar/hekimler", label: "Hekimler", permission: { clinicSettings: ["read"] } },
  {
    href: "/panel/ayarlar/hizmetler",
    label: "Hizmetler",
    permission: { clinicSettings: ["read"] },
  },
  { href: "/panel/ayarlar/asistan", label: "Asistan", permission: { assistantSettings: ["read"] } },
  {
    href: "/panel/ayarlar/randevu-kurallari",
    label: "Randevu kuralları",
    permission: { clinicSettings: ["read"] },
  },
  { href: "/panel/ayarlar/ekip", label: "Ekip", permission: { invitation: ["create"] } },
  { href: "/panel/ayarlar/denetim", label: "Denetim kaydı", permission: { audit: ["read"] } },
];

export default async function SettingsLayout({ children }: LayoutProps<"/panel/ayarlar">) {
  await requirePermission({ clinicSettings: ["read"] });
  const allowed = await Promise.all(
    SECTIONS.map(async (section) => ((await can(section.permission)) ? section : null)),
  );
  const items = allowed
    .filter((section) => section !== null)
    .map(({ href, label }) => ({ href, label }));

  return (
    <>
      <PageHeader title="Ayarlar" description="Kliniğinizin bilgileri ve asistanın çalışma şekli" />
      <div className="flex flex-col gap-6 lg:flex-row">
        <SettingsNav items={items} />
        <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
      </div>
    </>
  );
}
