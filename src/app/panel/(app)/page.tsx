import { ArrowRight, Bot, CalendarCheck2, PhoneCall, PhoneForwarded } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import {
  AppointmentStatusBadge,
  EmptyState,
  PageHeader,
  ScheduleGrid,
  type ScheduleAppointment,
} from "@/components/panel";
import { Button } from "@/components/ui/button";
import { formatLongDate, formatMinutes, formatRelative } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { can, requirePanelScope } from "@/server/auth/session";
import { db } from "@/server/db";
import { loadClinicDirectory, practitionerDisplayName } from "@/server/domain/clinics";
import {
  listCallbacks,
  recentAssistantBookings,
  scheduleRange,
  todayOverview,
} from "@/server/domain/panel";
import { isoWeekday } from "@/server/domain/time";

export const metadata: Metadata = { title: "Bugün" };

export default async function TodayPage() {
  await connection();
  const { context, scope } = await requirePanelScope({ appointments: ["read"] });
  const now = new Date();

  const [overview, directory, recent, canSeeCallbacks] = await Promise.all([
    todayOverview(db(), scope, now),
    loadClinicDirectory(db(), context.clinic.id),
    recentAssistantBookings(db(), scope, 5),
    can({ callbacks: ["read"] }),
  ]);
  const callbacks = canSeeCallbacks ? await listCallbacks(db(), context.clinic.id, "open", 5) : [];

  const columns = directory.practitioners
    .filter((p) => !scope.practitionerId || p.id === scope.practitionerId)
    .map((p) => ({ id: p.id, label: practitionerDisplayName(p) }));
  const gridAppointments: ScheduleAppointment[] = overview.appointments.map((a) => ({
    id: a.id,
    columnId: a.practitionerId,
    startMinute: a.startMinute,
    endMinute: a.endMinute,
    title: a.patientName,
    detail: a.serviceName,
    status: a.status,
    source: a.source,
    href: `/panel/randevular/${a.id}`,
  }));
  const range = scheduleRange(
    directory.clinicHours,
    [isoWeekday(overview.date)],
    overview.appointments,
  );
  const nowLocal = new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: context.clinic.timezone,
  })
    .format(now)
    .split(":")
    .map(Number);
  const nowMinute = nowLocal[0]! * 60 + nowLocal[1]!;

  const stats = [
    { icon: CalendarCheck2, value: overview.stats.appointmentsToday, label: "Bugünkü randevu" },
    { icon: Bot, value: overview.stats.bookedByAssistantToday, label: "Asistanın bugün aldığı" },
    { icon: PhoneCall, value: overview.stats.callsToday, label: "Bugünkü arama" },
    ...(canSeeCallbacks
      ? [{ icon: PhoneForwarded, value: overview.stats.openCallbacks, label: "Açık geri arama" }]
      : []),
  ];

  return (
    <>
      <PageHeader
        title={`Merhaba, ${context.session.user.name.split(" ")[0]}`}
        description={formatLongDate(overview.date)}
        actions={
          <Button asChild variant="outline">
            <Link href="/panel/takvim">
              Takvime git
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        }
      />

      <section
        aria-label="Günün özeti"
        className="surface-dark relative overflow-hidden rounded-section p-4 sm:p-6"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-primary/30 blur-3xl"
        />
        <dl className="relative grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map(({ icon: Icon, value, label }) => (
            <div key={label} className="flex flex-col gap-3 rounded-card glass p-4 sm:p-5">
              <Icon aria-hidden className="size-5 text-accent" />
              <dd className="text-3xl text-display font-semibold tabular-nums sm:text-4xl">
                {value}
              </dd>
              <dt className="text-sm text-on-dark-muted">{label}</dt>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="today-schedule" className="flex min-w-0 flex-col gap-3">
          <h2 id="today-schedule" className="text-label text-body">
            Günün takvimi
          </h2>
          {columns.length === 0 ? (
            <EmptyState
              icon={CalendarCheck2}
              title="Tanımlı hekim yok"
              description="Takvimin görünmesi için Ayarlar'dan hekim ekleyin."
            />
          ) : (
            <ScheduleGrid
              label="Bugünün randevuları"
              columns={columns}
              appointments={gridAppointments}
              range={range}
              nowMinute={nowMinute}
            />
          )}
        </section>

        <div className="flex flex-col gap-6">
          <section
            aria-labelledby="recent-bookings"
            className="flex flex-col gap-3 rounded-card border border-hairline bg-paper p-5"
          >
            <h2 id="recent-bookings" className="text-label text-body">
              Asistanın son aldığı randevular
            </h2>
            {recent.length === 0 ? (
              <p className="text-sm text-body">Asistan henüz randevu oluşturmadı.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-hairline">
                {recent.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/panel/randevular/${a.id}`}
                      className="-mx-2 flex items-center gap-3 rounded-card-sm px-2 py-3 hover:bg-canvas"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft">
                        <Bot aria-hidden className="size-4 text-primary" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium text-heading">
                          {a.patientName}
                        </span>
                        <span className="truncate text-xs text-body">
                          {formatLongDate(a.date).split(" ").slice(0, 2).join(" ")} ·{" "}
                          {formatMinutes(a.startMinute)} · {a.serviceName}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <AppointmentStatusBadge status={a.status} />
                        <span className="text-[11px] text-body">
                          {formatRelative(a.createdAt, now)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {canSeeCallbacks && (
            <section
              aria-labelledby="open-callbacks"
              className="flex flex-col gap-3 rounded-card border border-hairline bg-paper p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 id="open-callbacks" className="text-label text-body">
                  Geri aranacaklar
                </h2>
                <Link
                  href="/panel/geri-arama"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Tümü
                </Link>
              </div>
              {callbacks.length === 0 ? (
                <p className="text-sm text-body">Bekleyen geri arama talebi yok.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-hairline">
                  {callbacks.map((c) => (
                    <li key={c.id} className="flex flex-col gap-0.5 py-3">
                      <span className="text-sm font-medium text-heading">
                        {c.patientName ?? "İsimsiz arayan"}
                      </span>
                      <span className="text-xs text-body tabular-nums">
                        {formatPhone(c.phone)} · {formatRelative(c.createdAt, now)}
                      </span>
                      <span className="line-clamp-2 text-sm text-body">{c.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
