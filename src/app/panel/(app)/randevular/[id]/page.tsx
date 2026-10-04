import { ArrowLeft, CalendarDays, Clock, PhoneCall, Stethoscope, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { AppointmentSourceBadge, AppointmentStatusBadge, PageHeader } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { STATUS_TRANSITIONS } from "@/lib/contracts/appointment";
import { formatLongDate, formatMinutes } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { can, requirePanelScope } from "@/server/auth/session";
import { db } from "@/server/db";
import { getAppointment } from "@/server/domain/panel";

import { AppointmentNotesForm, StatusActions } from "./appointment-actions";

export const metadata: Metadata = { title: "Randevu" };

export default async function AppointmentPage({ params }: PageProps<"/panel/randevular/[id]">) {
  const { id } = await params;
  const { scope } = await requirePanelScope({ appointments: ["read"] });
  const appointment = /^[0-9a-f-]{36}$/i.test(id) ? await getAppointment(db(), scope, id) : null;
  if (!appointment) notFound();

  const [canUpdate, canCancel, canSeeCalls] = await Promise.all([
    can({ appointments: ["update"] }),
    can({ appointments: ["cancel"] }),
    can({ calls: ["read"] }),
  ]);
  const transitions = STATUS_TRANSITIONS[appointment.status].filter((status) =>
    status === "cancelled" ? canCancel : canUpdate,
  );

  return (
    <>
      <Link
        href="/panel/randevular"
        className="inline-flex w-fit items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Randevular
      </Link>
      <PageHeader
        title={appointment.patientName}
        description={`${formatLongDate(appointment.date)} · ${formatMinutes(appointment.startMinute)}`}
        actions={
          <div className="flex items-center gap-2">
            <AppointmentStatusBadge status={appointment.status} />
            <AppointmentSourceBadge source={appointment.source} />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="flex flex-col gap-6 rounded-card border border-hairline bg-paper p-6">
          <dl className="grid gap-5 sm:grid-cols-2">
            <Detail icon={UserRound} label="Hasta">
              {appointment.patientName}
              <span className="block text-sm text-body tabular-nums">
                {formatPhone(appointment.patientPhone)}
              </span>
            </Detail>
            <Detail icon={Stethoscope} label="Hizmet ve hekim">
              {appointment.serviceName}
              <span className="block text-sm text-body">{appointment.practitionerName}</span>
            </Detail>
            <Detail icon={CalendarDays} label="Tarih">
              {formatLongDate(appointment.date)}
            </Detail>
            <Detail icon={Clock} label="Saat">
              <span className="tabular-nums">
                {formatMinutes(appointment.startMinute)}–{formatMinutes(appointment.endMinute)}
              </span>
            </Detail>
          </dl>
          {appointment.callId && canSeeCalls && (
            <Button asChild variant="outline" className="w-fit">
              <Link href={`/panel/aramalar/${appointment.callId}`}>
                <PhoneCall data-icon="inline-start" />
                Randevunun alındığı arama
              </Link>
            </Button>
          )}
          <AppointmentNotesForm
            appointmentId={appointment.id}
            notes={appointment.notes ?? ""}
            editable={canUpdate}
          />
        </section>

        <aside className="flex flex-col gap-3 rounded-card border border-hairline bg-paper p-6">
          <h2 className="text-label text-body">Durumu değiştir</h2>
          {transitions.length === 0 ? (
            <p className="text-sm text-body">
              {appointment.status === "cancelled"
                ? "İptal edilen randevu geri alınamaz. Gerekirse yeni randevu oluşturun."
                : "Bu randevu için yapabileceğiniz bir durum değişikliği yok."}
            </p>
          ) : (
            <StatusActions appointmentId={appointment.id} transitions={transitions} />
          )}
        </aside>
      </div>
    </>
  );
}

function Detail({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof UserRound;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft">
        <Icon aria-hidden className="size-4 text-primary" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <dt className="text-label text-body">{label}</dt>
        <dd className="font-medium text-heading">{children}</dd>
      </div>
    </div>
  );
}
