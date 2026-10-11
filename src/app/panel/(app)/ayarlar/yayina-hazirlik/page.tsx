import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { env } from "@/lib/env";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { goLiveChecks, type GoLiveState } from "@/server/domain/go-live";

import { SettingsCardStatic } from "../denetim/settings-card-static";

export const metadata: Metadata = { title: "Yayına hazırlık" };

/** DESIGN.md: the label carries the meaning, colour only supports it. */
const STATE: Record<
  GoLiveState,
  { label: string; variant: "success" | "destructive" | "secondary" }
> = {
  ok: { label: "Hazır", variant: "success" },
  warn: { label: "Bakılmalı", variant: "destructive" },
  off: { label: "Kapalı", variant: "secondary" },
};

/**
 * Read-only go-live check (R2 5c, PANEL_GO_LIVE_CHECK): line, assistant,
 * calendar data, SMS, the KVKK deletion queue and the switch states.
 * Owners and admins only (billing.read).
 */
export default async function GoLivePage() {
  const config = env();
  if (config.PANEL_GO_LIVE_CHECK !== true) notFound();
  const context = await requirePermission({ billing: ["read"] });
  const { checks, switches } = await goLiveChecks(db(), context.clinic.id, config);

  return (
    <>
      <SettingsCardStatic
        title="Yayına hazırlık"
        description="Asistanın gerçek aramalara açılmadan önce kontrol listesi. Değişiklikler Recall ekibi tarafından yapılır."
      >
        <ul className="flex flex-col divide-y divide-hairline">
          {checks.map((check) => (
            <li key={check.label} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-heading">{check.label}</p>
                <p className="text-sm text-body">{check.detail}</p>
              </div>
              <Badge variant={STATE[check.state].variant}>{STATE[check.state].label}</Badge>
            </li>
          ))}
        </ul>
      </SettingsCardStatic>
      <SettingsCardStatic
        title="Anahtarlar"
        description="Recall ekibinin açtığı özellikler. Açık olmayanlar bugünkü davranışla çalışır."
      >
        <ul className="flex flex-col divide-y divide-hairline">
          {switches.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-sm text-heading">{item.label}</span>
              <Badge variant={item.on ? "soft" : "secondary"}>{item.on ? "Açık" : "Kapalı"}</Badge>
            </li>
          ))}
        </ul>
      </SettingsCardStatic>
    </>
  );
}
