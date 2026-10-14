import { Building2, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { EmptyState, PageHeader } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { env } from "@/lib/env";
import { requirePlatformAdmin } from "@/server/auth/session";
import { listConsoleUsers, mayResetTwoFactor } from "@/server/auth/two-factor";
import { db } from "@/server/db";
import { listClinicsOverview } from "@/server/platform/clinics";

import { ConsoleUsers } from "./console-users";

export const metadata: Metadata = { title: "Klinikler" };

const usd = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "USD" });
const date = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});

function AgentBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="dashed">Asistan yok</Badge>;
  if (status === "synced") return <Badge variant="success">Güncel</Badge>;
  if (status === "error") return <Badge variant="destructive">Hata</Badge>;
  return <Badge variant="soft">Bekliyor</Badge>;
}

export default async function ConsoleHomePage() {
  await connection();
  const session = await requirePlatformAdmin();
  const clinics = await listClinicsOverview(db(), new Date());
  // Only the Recall owner (TWO_FACTOR_RESET_EMAILS); also while the switch is
  // off, so a locked-out owner account can be reset (TWO-FACTOR-RECOVERY.md).
  const consoleUsers = mayResetTwoFactor(session.user.email, env().TWO_FACTOR_RESET_EMAILS)
    ? await listConsoleUsers(db())
    : null;
  const totals = clinics.reduce(
    (sum, clinic) => ({
      calls: sum.calls + clinic.stats.calls,
      minutes: sum.minutes + clinic.stats.minutes,
      cost: sum.cost + clinic.stats.costUsd,
    }),
    { calls: 0, minutes: 0, cost: 0 },
  );

  return (
    <>
      <PageHeader
        title="Klinikler"
        description="Son 30 günün aramaları ve asistan durumu"
        actions={
          <Button asChild>
            <Link href="/admin/klinikler/yeni">
              <Plus data-icon="inline-start" />
              Yeni klinik
            </Link>
          </Button>
        }
      />

      <section
        aria-label="Toplamlar"
        className="surface-dark relative overflow-hidden rounded-section p-4 sm:p-6"
      >
        <dl className="relative grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            [clinics.length, "Klinik"],
            [totals.calls, "Arama (30 gün)"],
            [Math.round(totals.minutes), "Dakika (30 gün)"],
            [usd.format(totals.cost), "Ses platformu maliyeti"],
          ].map(([value, label]) => (
            <div key={String(label)} className="flex flex-col gap-2 rounded-card glass p-4 sm:p-5">
              <dd className="text-3xl text-display font-semibold tabular-nums">{value}</dd>
              <dt className="text-sm text-on-dark-muted">{label}</dt>
            </div>
          ))}
        </dl>
      </section>

      {clinics.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Henüz klinik yok"
          action={
            <Button asChild size="sm">
              <Link href="/admin/klinikler/yeni">İlk kliniği oluştur</Link>
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Klinik</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Asistan</TableHead>
              <TableHead>Ekip / numara</TableHead>
              <TableHead>Arama</TableHead>
              <TableHead>Dakika</TableHead>
              <TableHead>Maliyet</TableHead>
              <TableHead>Son arama</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clinics.map((clinic) => (
              <TableRow key={clinic.id} className="relative">
                <TableCell>
                  <Link
                    href={`/admin/klinikler/${clinic.id}`}
                    className="font-medium after:absolute after:inset-0 hover:text-primary"
                  >
                    {clinic.name}
                  </Link>
                  <span className="block text-xs text-body">{clinic.slug}</span>
                </TableCell>
                <TableCell>
                  {clinic.status === "active" ? (
                    <Badge variant="soft">Aktif</Badge>
                  ) : (
                    <Badge variant="secondary">Duraklatıldı</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <AgentBadge status={clinic.agentStatus} />
                </TableCell>
                <TableCell className="text-body tabular-nums">
                  {clinic.members} kişi · {clinic.numbers} numara
                </TableCell>
                <TableCell className="tabular-nums">{clinic.stats.calls}</TableCell>
                <TableCell className="tabular-nums">{clinic.stats.minutes}</TableCell>
                <TableCell className="tabular-nums">{usd.format(clinic.stats.costUsd)}</TableCell>
                <TableCell className="text-body">
                  {clinic.stats.lastCallAt ? date.format(clinic.stats.lastCallAt) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {consoleUsers && (
        <section className="mt-8 flex flex-col gap-2 rounded-card border border-hairline bg-paper p-5">
          <h2 className="text-base font-semibold text-heading">Recall konsol kullanıcıları</h2>
          <p className="text-xs text-body">
            Telefonunu ve yedek kodlarını kaybeden konsol kullanıcısının iki adımlı girişini
            yalnızca Recall sahibi sıfırlar, kimliği konsol dışından doğruladıktan sonra
            (docs/06-operations/TWO-FACTOR-RECOVERY.md).
          </p>
          <ConsoleUsers users={consoleUsers} selfId={session.user.id} />
        </section>
      )}
    </>
  );
}
