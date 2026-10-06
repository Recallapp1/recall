import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { PageHeader } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { INTERVAL_UNIT_LOCATIVE, STOP_REASON_LABELS } from "@/lib/contracts/follow-up";
import { NOTIFICATION_STATUS_LABELS } from "@/lib/contracts/notification";
import { formatLongDate, formatShortDate } from "@/lib/format";
import { can, requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { followUpView } from "@/server/domain/follow-up-logic";
import { getPlanDetail, listLinkableAppointments } from "@/server/domain/follow-ups";
import { localToday } from "@/server/domain/time";

import { loadBookingOptions } from "../../randevular/booking-options";
import { FollowUpViewBadge } from "../view-badge";
import { PlanControls, VisitRow } from "./plan-controls";

export const metadata: Metadata = { title: "Takip" };

const SKIP_LABELS: Record<string, string> = {
  sending_disabled: "SMS gönderimi henüz etkin değil",
  provider_disabled: "SMS sağlayıcısı bağlı değil",
  feature_off: "Klinikte SMS hatırlatma kapalı",
  no_consent: "SMS onayı yok",
  opted_out: "Hasta SMS istemiyor",
  invalid_phone: "Telefon numarası geçersiz",
  cap_reached: "Günlük SMS sınırı",
  subject_changed: "Takip değişti",
  patient_removed: "Hasta kaydı silindi",
  too_late: "Zamanında planlanamadı",
};

export default async function FollowUpDetailPage({ params }: PageProps<"/panel/takip/[id]">) {
  await connection();
  const context = await requirePermission({ followUps: ["read"] });
  if (!context.settings.features.followUp) notFound();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const scope = { clinicId: context.clinic.id, timeZone: context.clinic.timezone };
  const now = new Date();

  let detail: Awaited<ReturnType<typeof getPlanDetail>>;
  try {
    detail = await getPlanDetail(db(), scope, id, now);
  } catch {
    notFound();
  }
  const { plan, patient, outcome, visits, reminders } = detail;
  const [canManage, canBook, canCorrect] = await Promise.all([
    can({ followUps: ["manage"] }),
    can({ appointments: ["create"] }),
    can({ appointments: ["update"] }),
  ]);
  const [booking, linkable] = await Promise.all([
    canManage && canBook ? loadBookingOptions(context) : null,
    canManage ? listLinkableAppointments(db(), scope, plan.patientId) : [],
  ]);
  const view = followUpView(
    outcome,
    localToday(now, context.clinic.timezone),
    context.settings.followUp.dueSoonDays,
  );
  const every = `Her ${plan.intervalValue} ${INTERVAL_UNIT_LOCATIVE[plan.intervalUnit]} bir`;
  const length = plan.totalVisits ? `toplam ${plan.totalVisits} ziyaret` : "süresiz";

  return (
    <>
      <Link
        href="/panel/takip"
        className="inline-flex w-fit items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Takip
      </Link>
      <PageHeader
        title={patient.fullName}
        description={`${plan.name} · ${every}, ${length} · Takip ziyareti: ${detail.visitServiceName}`}
        actions={<FollowUpViewBadge view={view} />}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="flex flex-col gap-6">
          <dl className="grid gap-4 rounded-card border border-hairline bg-paper p-5 sm:grid-cols-3">
            <Fact label="Sonraki tarih">
              {outcome.nextDueOn ? formatLongDate(outcome.nextDueOn) : "—"}
              {plan.dueOverrideOn && outcome.nextDueOn === plan.dueOverrideOn && (
                <Badge variant="secondary" className="ml-2">
                  elle verildi
                </Badge>
              )}
            </Fact>
            <Fact label="Ziyaret">
              {plan.totalVisits
                ? `${outcome.visitsDone} / ${plan.totalVisits}`
                : outcome.visitsDone}
            </Fact>
            <Fact label="Son ziyaret">
              {outcome.lastVisitOn ? formatShortDate(outcome.lastVisitOn) : "—"}
            </Fact>
            <Fact label="Başlangıç">{formatShortDate(plan.startedOn)}</Fact>
            <Fact label="SMS onayı">{plan.smsConsentAt ? "Var" : "Yok (hasta aranır)"}</Fact>
            {plan.state === "stopped" && plan.stoppedReason && (
              <Fact label="Bırakılma sebebi">
                {STOP_REASON_LABELS[plan.stoppedReason as keyof typeof STOP_REASON_LABELS] ??
                  plan.stoppedReason}
              </Fact>
            )}
          </dl>

          <section className="flex flex-col gap-3">
            <h2 className="text-label text-body">Ziyaretler</h2>
            {visits.length === 0 ? (
              <p className="rounded-card border border-hairline bg-paper p-5 text-sm text-body">
                Henüz bağlı randevu veya kayıtlı ziyaret yok.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-hairline rounded-card border border-hairline bg-paper">
                {visits.map((visit) => (
                  <VisitRow
                    key={visit.id}
                    planId={plan.id}
                    visit={{
                      appointmentId: visit.appointmentId,
                      source: visit.source,
                      status: visit.status,
                    }}
                    canManage={canManage}
                    canCorrect={canCorrect}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-label text-body">Hatırlatma geçmişi</h2>
            {reminders.length === 0 ? (
              <p className="text-sm text-body">Bu takip için hatırlatma planlanmadı.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-hairline rounded-card border border-hairline bg-paper text-sm">
                {reminders.map((reminder, index) => (
                  <li key={index} className="flex flex-wrap justify-between gap-2 px-5 py-3">
                    <span className="text-heading">
                      {new Intl.DateTimeFormat("tr-TR", {
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: context.clinic.timezone,
                      }).format(reminder.sentAt ?? reminder.createdAt)}
                    </span>
                    <span className="text-body">
                      {NOTIFICATION_STATUS_LABELS[reminder.status]}
                      {reminder.skipReason &&
                        ` · ${SKIP_LABELS[reminder.skipReason] ?? reminder.skipReason}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </section>

        <aside className="flex h-fit flex-col gap-4">
          <Link
            href={`/panel/hastalar/${patient.id}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Hasta sayfası
          </Link>
          {canManage && (
            <PlanControls
              plan={{
                id: plan.id,
                state: plan.state,
                hasOverride: plan.dueOverrideOn !== null,
                smsConsent: plan.smsConsentAt !== null,
                visitServiceId: plan.visitServiceId,
              }}
              patient={{ fullName: patient.fullName, phone: patient.phone }}
              booking={booking}
              linkable={linkable}
            />
          )}
        </aside>
      </div>
    </>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-body">{label}</dt>
      <dd className="text-sm font-medium text-heading">{children}</dd>
    </div>
  );
}
