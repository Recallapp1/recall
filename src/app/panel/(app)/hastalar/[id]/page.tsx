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
import { formatMinutes, formatShortDate } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { can, requirePanelScope } from "@/server/auth/session";
import { db } from "@/server/db";
import { getPatient } from "@/server/domain/panel";

import { AnonymizeButton, PatientNotesForm } from "./patient-actions";

export const metadata: Metadata = { title: "Hasta" };

export default async function PatientPage({ params }: PageProps<"/panel/hastalar/[id]">) {
  const { id } = await params;
  const { scope } = await requirePanelScope({ patients: ["read"] });
  const result = /^[0-9a-f-]{36}$/i.test(id) ? await getPatient(db(), scope, id) : null;
  if (!result) notFound();
  const { patient, appointments } = result;
  const [canUpdate, canAnonymize, canExport] = await Promise.all([
    can({ patients: ["update"] }),
    can({ patients: ["anonymize"] }),
    can({ patients: ["export"] }),
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
                    Hasta silme talebinde ad, telefon, notlar, bu numaradan gelen aramaların dökümü
                    ve ses kayıtları kalıcı olarak silinir. Randevu geçmişi istatistik için anonim
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
