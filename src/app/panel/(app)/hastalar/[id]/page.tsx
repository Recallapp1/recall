import { ArrowLeft, Download, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AppointmentSourceBadge,
  AppointmentStatusBadge,
  EmptyState,
  PageHeader,
} from "@/components/panel";
import { Button } from "@/components/ui/button";
import { FOLLOW_UP_STATE_LABELS } from "@/lib/contracts/follow-up";
import { formatMinutes, formatShortDate } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { can, requirePanelScope } from "@/server/auth/session";
import { db } from "@/server/db";
import { listActiveRules, listPatientPlans } from "@/server/domain/follow-ups";
import { getPatient } from "@/server/domain/panel";
import { localToday } from "@/server/domain/time";

import { StartFollowUpButton } from "../../takip/start-follow-up";

import { AnonymizeButton, PatientNotesForm, SmsOptOutSwitch } from "./patient-actions";

export const metadata: Metadata = { title: "Hasta" };

export default async function PatientPage({ params }: PageProps<"/panel/hastalar/[id]">) {
  const { id } = await params;
  const { scope, context } = await requirePanelScope({ patients: ["read"] });
  const result = /^[0-9a-f-]{36}$/i.test(id) ? await getPatient(db(), scope, id) : null;
  if (!result) notFound();
  const { patient, appointments } = result;
  const followUpOn = context.settings.features.followUp;
  const [canUpdate, canAnonymize, canExport, canSeeFollowUps, canManageFollowUps] =
    await Promise.all([
      can({ patients: ["update"] }),
      can({ patients: ["anonymize"] }),
      can({ patients: ["export"] }),
      followUpOn ? can({ followUps: ["read"] }) : false,
      followUpOn ? can({ followUps: ["manage"] }) : false,
    ]);
  const [plans, startRules] = await Promise.all([
    canSeeFollowUps ? listPatientPlans(db(), scope.clinicId, patient.id) : [],
    canManageFollowUps ? listActiveRules(db(), scope.clinicId) : [],
  ]);

  return (
    <>
      <Link
        href="/panel/hastalar"
        className="inline-flex w-fit items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Hastalar
      </Link>
      <PageHeader
        title={patient.fullName}
        description={`${appointments.length} randevu`}
        actions={
          <a
            href={`tel:${patient.phone}`}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-on-dark tabular-nums hover:bg-primary-hover"
          >
            <Phone aria-hidden className="size-4" />
            {formatPhone(patient.phone)}
          </a>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="flex flex-col gap-3">
          <h2 className="text-label text-body">Randevu geçmişi</h2>
          {appointments.length === 0 ? (
            <EmptyState icon={Phone} title="Randevu yok" />
          ) : (
            <ul className="flex flex-col divide-y divide-hairline rounded-card border border-hairline bg-paper">
              {appointments.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/panel/randevular/${a.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-canvas"
                  >
                    <span className="flex flex-col">
                      <span className="text-sm font-medium text-heading tabular-nums">
                        {formatShortDate(a.date)} · {formatMinutes(a.startMinute)}
                      </span>
                      <span className="text-xs text-body">
                        {a.serviceName} · {a.practitionerName}
                      </span>
                    </span>
                    <span className="flex gap-2">
                      <AppointmentStatusBadge status={a.status} />
                      <AppointmentSourceBadge source={a.source} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex h-fit flex-col gap-6 rounded-card border border-hairline bg-paper p-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-label text-body">İletişim</h2>
            <SmsOptOutSwitch
              patientId={patient.id}
              optedOut={patient.smsOptOutAt !== null}
              editable={canUpdate}
            />
            <p className="text-xs text-body">
              Açıkken bu hastaya hatırlatma veya takip SMS&apos;i gönderilmez.
            </p>
          </div>
          {canSeeFollowUps && (
            <div className="flex flex-col gap-3 border-t border-hairline pt-5">
              <h2 className="text-label text-body">Takip</h2>
              {plans.length === 0 ? (
                <p className="text-sm text-body">Bu hastanın takibi yok.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {plans.map((plan) => (
                    <li key={plan.id}>
                      <Link
                        href={`/panel/takip/${plan.id}`}
                        className="flex flex-col text-sm hover:underline"
                      >
                        <span className="font-medium text-heading">{plan.name}</span>
                        <span className="text-xs text-body">
                          {FOLLOW_UP_STATE_LABELS[plan.state]}
                          {plan.nextDueOn && ` · sonraki ${formatShortDate(plan.nextDueOn)}`}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {canManageFollowUps && (
                <StartFollowUpButton
                  rules={startRules}
                  patientId={patient.id}
                  appointment={null}
                  today={localToday(new Date(), scope.timeZone)}
                />
              )}
            </div>
          )}
          <PatientNotesForm
            patientId={patient.id}
            notes={patient.notes ?? ""}
            editable={canUpdate}
          />
          {(canExport || canAnonymize) && (
            <div className="flex flex-col gap-3 border-t border-hairline pt-5">
              <h2 className="text-label text-body">KVKK</h2>
              {canExport && (
                <>
                  <p className="text-xs text-body">
                    Bilgi talebinde hastanın kliniğinizdeki tüm kayıtlarını (randevular, arama
                    özetleri ve dökümleri, geri arama talepleri) dosya olarak indirin.
                  </p>
                  <Button asChild variant="outline" size="sm" className="w-fit">
                    <a href={`/panel/hastalar/${patient.id}/disa-aktar`} download>
                      <Download data-icon="inline-start" />
                      Verileri indir
                    </a>
                  </Button>
                </>
              )}
              {canAnonymize && (
                <>
                  <p className="text-xs text-body">
                    Hasta silme talebinde ad, telefon, notlar, bu hastayla ilgili aramaların dökümü
                    ve ses kayıtları kalıcı olarak silinir: hastaya bağlı aramalar ve bu numaradan
                    gelen aramalar. Numarayı ayrı kaydı olan başka hastalar da kullanıyorsa,
                    yalnızca onlara ait aramalar korunur. Randevu geçmişi istatistik için anonim
                    kalır.
                  </p>
                  <AnonymizeButton patientId={patient.id} />
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
