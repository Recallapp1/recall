import { PageHeader } from "@/components/panel";
import { env } from "@/lib/env";
import type { Permissions } from "@/lib/permissions";
import { can, requirePermission } from "@/server/auth/session";

import { SettingsNav } from "./settings-nav";

const SECTIONS: {
  href: string;
  label: string;
  permission: Permissions;
  feature?: "followUp";
  /** Shown only while its switch is on. */
  enabled?: () => boolean;
}[] = [
  { href: "/panel/ayarlar", label: "Klinik", permission: { clinicSettings: ["read"] } },
  {
    href: "/panel/ayarlar/calisma-saatleri",
    label: "Çalışma saatleri",
    permission: { clinicSettings: ["read"] },
  },
  {
    href: "/panel/ayarlar/tatiller",
    label: "Tatil ve izinler",
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
  {
    href: "/panel/ayarlar/takip",
    label: "Takip kuralları",
    permission: { clinicSettings: ["read"] },
    feature: "followUp",
  },
  { href: "/panel/ayarlar/ekip", label: "Ekip", permission: { invitation: ["create"] } },
  { href: "/panel/ayarlar/denetim", label: "Denetim kaydı", permission: { audit: ["read"] } },
  {
    href: "/panel/ayarlar/sinirlar",
    label: "Kullanım ve sınırlar",
    permission: { billing: ["read"] },
    enabled: () => env().PANEL_LIMITS_VIEW === true,
  },
];

export default async function SettingsLayout({ children }: LayoutProps<"/panel/ayarlar">) {
  const { settings } = await requirePermission({ clinicSettings: ["read"] });
  const allowed = await Promise.all(
    SECTIONS.map(async (section) =>
      (!section.feature || settings.features[section.feature]) &&
      (!section.enabled || section.enabled()) &&
      (await can(section.permission))
        ? section
        : null,
    ),
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
