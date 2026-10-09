import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { env } from "@/lib/env";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { clinicUsage } from "@/server/domain/voice-limits";

import { SettingsCardStatic } from "../denetim/settings-card-static";

export const metadata: Metadata = { title: "Kullanım ve sınırlar" };

/**
 * Read-only view of the clinic's voice limits and today's usage (audit A8).
 * Limits are set by the Recall team; the page only shows them.
 */
export default async function LimitsPage() {
  if (env().PANEL_LIMITS_VIEW !== true) notFound();
  const context = await requirePermission({ billing: ["read"] });
  const usage = await clinicUsage(db(), context, new Date());
  const { limits } = context.settings;

  const rows: { label: string; used: string | null; limit: string }[] = [
    {
      label: "Bugünkü ses dakikası",
      used: String(usage.voiceMinutesToday),
      limit: `${limits.dailyVoiceMinutes} dk`,
    },
    {
      label: "Son bir saatteki aramalar",
      used: String(usage.callsLastHour),
      limit: `${limits.callsPerHour} arama`,
    },
    { label: "Bugünkü aramalar", used: String(usage.callsToday), limit: "—" },
    {
      label: "Asistanın bugün aldığı randevular",
      used: String(usage.voiceBookingsToday),
      limit: "—",
    },
    { label: "Bir numaradan saatlik arama", used: null, limit: `${limits.callsPerNumberPerHour}` },
    { label: "Bir numaradan günlük arama", used: null, limit: `${limits.callsPerNumberPerDay}` },
    {
      label: "Gizli numaralı aramalar (saatlik, toplam)",
      used: null,
      limit: `${limits.hiddenCallsPerHour}`,
    },
    { label: "Bir aramanın en uzun süresi", used: null, limit: `${limits.maxCallMinutes} dk` },
    { label: "Bir aramada yeni randevu", used: null, limit: `${limits.bookingsPerCall}` },
    {
      label: "Bir numaraya günlük yeni randevu",
      used: null,
      limit: `${limits.bookingsPerNumberPerDay}`,
    },
  ];

  return (
    <SettingsCardStatic
      title="Kullanım ve sınırlar"
      description="Sesli asistanın kötüye kullanım ve maliyet sınırları ile bugünkü kullanım. Sınırları Recall ekibi belirler; değişiklik için bizimle iletişime geçin."
    >
      <Table className="min-w-[28rem]">
        <TableHeader>
          <TableRow>
            <TableHead>Ölçü</TableHead>
            <TableHead>Bugün</TableHead>
            <TableHead>Sınır</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.label}>
              <TableCell>{row.label}</TableCell>
              <TableCell className="tabular-nums">{row.used ?? "—"}</TableCell>
              <TableCell className="tabular-nums">{row.limit}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SettingsCardStatic>
  );
}
