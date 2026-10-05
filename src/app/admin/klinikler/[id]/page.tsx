import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { OutcomeBadge, PageHeader } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { isBuiltInRole, ROLE_LABELS } from "@/lib/permissions";
import { formatPhone } from "@/lib/phone";
import { requirePlatformAdmin } from "@/server/auth/session";
import { db } from "@/server/db";
import { getClinicOverview } from "@/server/platform/clinics";

import {
  AddMemberForm,
  AssistantActions,
  ClinicStatusButton,
  PhoneNumbers,
} from "./clinic-actions";

export const metadata: Metadata = { title: "Klinik" };

const usd = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "USD" });
const when = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-card border border-hairline bg-paper p-6">
      <h2 className="text-label text-body">{title}</h2>
      {children}
    </section>
  );
}

export default async function ClinicConsolePage({
  params,
  searchParams,
}: PageProps<"/admin/klinikler/[id]">) {
  await connection();
  await requirePlatformAdmin();
  const { id } = await params;
  const created = (await searchParams).olusturuldu === "1";
  const overview = /^[0-9a-f-]{36}$/i.test(id)
    ? await getClinicOverview(db(), id, new Date())
    : null;
  if (!overview) notFound();
  const { clinic, agent, numbers, team, checklist, outcomes, stats } = overview;
  const done = checklist.filter((item) => item.done).length;

  return (
    <>
      <Link
        href="/admin"
        className="inline-flex w-fit items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Klinikler
      </Link>
      <PageHeader
        title={clinic.name}
        description={`${clinic.slug} · ${clinic.timezone}`}
        actions={
          <>
            {clinic.status === "active" ? (
              <Badge variant="soft">Aktif</Badge>
            ) : (
              <Badge variant="secondary">Duraklatıldı</Badge>
            )}
            <ClinicStatusButton clinicId={clinic.id} status={clinic.status} />
          </>
        }
      />
      {created && (
        <p role="status" className="rounded-card-sm bg-success-soft px-4 py-3 text-sm text-success">
          Klinik oluşturuldu ve klinik sahibine parola belirleme e-postası gönderildi. Sıradaki
          adımlar: asistanı oluşturmak ve numarayı bağlamak.
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={`Canlıya geçiş kontrol listesi · ${done}/${checklist.length}`}>
          <ul className="flex flex-col gap-2.5">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-center gap-2.5 text-sm">
                {item.done ? (
                  <CheckCircle2 aria-hidden className="size-4 text-success" />
                ) : (
                  <Circle aria-hidden className="size-4 text-body" />
                )}
                <span className={item.done ? "text-heading" : "text-body"}>
                  {item.label}
                  <span className="sr-only">{item.done ? " (tamam)" : " (eksik)"}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-body">
            Hekim, hizmet, saat ve tatiller klinik panelinden; numara ve asistan buradan yönetilir.
          </p>
        </Card>

        <Card title="Sesli asistan">
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-heading">
              {agent
                ? agent.status === "synced"
                  ? "Güncel"
                  : agent.status === "error"
                    ? "Son senkron başarısız"
                    : "Senkron bekliyor"
                : "Henüz oluşturulmadı"}
            </span>
            {agent?.syncedAt && (
              <span className="text-body">Son senkron: {when.format(agent.syncedAt)}</span>
            )}
            {agent?.externalAgentId && (
              <span className="font-mono text-xs text-body">{agent.externalAgentId}</span>
            )}
            {agent?.status === "error" && agent.lastError && (
              <span className="rounded-card-sm bg-danger-soft px-3 py-2 text-xs text-danger">
                {agent.lastError}
              </span>
            )}
          </div>
          <AssistantActions clinicId={clinic.id} exists={Boolean(agent?.externalAgentId)} />
        </Card>

        <Card title="Telefon numaraları">
          <PhoneNumbers
            clinicId={clinic.id}
            numbers={numbers.map((n) => ({
              id: n.id,
              label: formatPhone(n.e164),
              active: n.isActive,
            }))}
          />
        </Card>

        <Card title="Son 30 gün">
          <dl className="grid grid-cols-3 gap-3">
            {[
              [stats.calls, "Arama"],
              [stats.minutes, "Dakika"],
              [usd.format(stats.costUsd), "Maliyet"],
            ].map(([value, label]) => (
              <div
                key={String(label)}
                className="flex flex-col gap-1 rounded-card-sm bg-canvas p-4"
              >
                <dd className="text-2xl text-display font-semibold text-heading tabular-nums">
                  {value}
                </dd>
                <dt className="text-xs text-body">{label}</dt>
              </div>
            ))}
          </dl>
          {outcomes.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {outcomes.map((row) => (
                <li key={row.outcome ?? "none"} className="flex items-center gap-1.5 text-sm">
                  <OutcomeBadge outcome={row.outcome} />
                  <span className="text-body tabular-nums">{row.value}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-body">
            Hasta adı, numarası ve konuşma içerikleri konsolda gösterilmez.
          </p>
        </Card>

        <Card title={`Ekip · ${team.length} kişi`}>
          <ul className="flex flex-col divide-y divide-hairline">
            {team.map((member) => (
              <li
                key={member.memberId}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-heading">{member.name}</span>
                  <span className="truncate text-xs text-body">{member.email}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant="outline">
                    {member.role
                      .split(",")
                      .map((r) => (isBuiltInRole(r) ? ROLE_LABELS[r] : r))
                      .join(", ")}
                  </Badge>
                  {!member.emailVerified && <Badge variant="dashed">Parola bekleniyor</Badge>}
                </span>
              </li>
            ))}
          </ul>
          <AddMemberForm clinicId={clinic.id} />
        </Card>
      </div>
    </>
  );
}
