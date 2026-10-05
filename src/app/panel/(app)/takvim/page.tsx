import { CalendarDays, CalendarOff, ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import {
  AutoRefresh,
  EmptyState,
  PageHeader,
  ScheduleGrid,
  type ScheduleAppointment,
  type ScheduleColumn,
} from "@/components/panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { calendarQuerySchema } from "@/lib/contracts/panel-appointment";
import { formatLongDate, formatShortDate } from "@/lib/format";
import { can, requirePanelScope } from "@/server/auth/session";
import { db } from "@/server/db";
import { loadClinicDirectory, practitionerDisplayName } from "@/server/domain/clinics";
import { listAppointments, scheduleRange } from "@/server/domain/panel";
import { getMemberPreferences } from "@/server/domain/preferences";
import { listTimeOff } from "@/server/domain/settings";
import { addLocalDays, isoWeekday, localToday, localToUtc } from "@/server/domain/time";

import { loadBookingOptions } from "../randevular/booking-options";
import { NewAppointmentDialog } from "../randevular/new-appointment-dialog";
import { PractitionerFilter } from "./practitioner-filter";

export const metadata: Metadata = { title: "Takvim" };

export default async function CalendarPage({ searchParams }: PageProps<"/panel/takvim">) {
  await connection();
  const { context, scope } = await requirePanelScope({ appointments: ["read"] });
  const query = calendarQuerySchema.parse(await searchParams);
  const now = new Date();
  const today = localToday(now, context.clinic.timezone);
  const date = query.tarih ?? today;
  const preferences = await getMemberPreferences(db(), context.member.id);
  const defaultView = preferences.calendarView ?? context.settings.panel.defaultCalendarView;
  const view = query.gorunum ?? defaultView;
  const week = view === "hafta";
  const from = week ? addLocalDays(date, 1 - isoWeekday(date)) : date;
  const to = addLocalDays(from, week ? 7 : 1);
  const selected = query.hekim ?? preferences.calendarPractitionerId ?? "tum";
  const practitionerFilter = scope.practitionerId || selected === "tum" ? undefined : selected;

  const rangeStart = localToUtc(from, 0, context.clinic.timezone);
  const rangeEnd = localToUtc(to, 0, context.clinic.timezone);
  const [directory, { rows }, canCreate, booking, closures] = await Promise.all([
    loadClinicDirectory(db(), context.clinic.id),
    listAppointments(db(), scope, { from, to, practitionerId: practitionerFilter }),
    can({ appointments: ["create"] }),
    loadBookingOptions(context),
    listTimeOff(db(), context.clinic.id, rangeStart).then((entries) =>
      entries.filter((entry) => entry.startsAt < rangeEnd),
    ),
  ]);

  const practitioners = directory.practitioners.filter(
    (p) =>
      (!scope.practitionerId || p.id === scope.practitionerId) &&
      (!practitionerFilter || p.id === practitionerFilter),
  );
  const days = Array.from({ length: week ? 7 : 1 }, (_, i) => addLocalDays(from, i));
  const openWeekdays = new Set(directory.clinicHours.map((h) => h.weekday));
  // Week view hides closed days unless something is booked on them.
  const visibleDays = week
    ? days.filter((d) => openWeekdays.has(isoWeekday(d)) || rows.some((r) => r.date === d))
    : days;

  const columns: ScheduleColumn[] = week
    ? visibleDays.map((d) => ({
        id: d,
        label: formatShortDate(d),
        description: d === today ? "Bugün" : undefined,
      }))
    : practitioners.map((p) => ({ id: p.id, label: practitionerDisplayName(p) }));
  const appointments: ScheduleAppointment[] = rows.map((a) => ({
    id: a.id,
    columnId: week ? a.date : a.practitionerId,
    startMinute: a.startMinute,
    endMinute: a.endMinute,
    title: a.patientName,
    detail:
      week && !practitionerFilter ? `${a.serviceName} · ${a.practitionerName}` : a.serviceName,
    status: a.status,
    source: a.source,
    href: `/panel/randevular/${a.id}`,
  }));
  const range = scheduleRange(directory.clinicHours, visibleDays.map(isoWeekday), rows);
  const nowParts = new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: context.clinic.timezone,
  })
    .format(now)
    .split(":")
    .map(Number);
  const showNow = !week && date === today;
  const closureFormat = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: context.clinic.timezone,
  });

  const href = (changes: { tarih?: string; gorunum?: string; hekim?: string | null }) => {
    const params = new URLSearchParams();
    const tarih = changes.tarih ?? date;
    const gorunum = changes.gorunum ?? view;
    // "All practitioners" must be explicit when a personal default filter exists.
    const all = preferences.calendarPractitionerId ? "tum" : undefined;
    const hekim = changes.hekim === null ? all : (changes.hekim ?? query.hekim);
    if (tarih !== today) params.set("tarih", tarih);
    if (gorunum !== defaultView) params.set("gorunum", gorunum);
    if (hekim) params.set("hekim", hekim);
    const search = params.toString();
    return search ? `/panel/takvim?${search}` : "/panel/takvim";
  };
  const step = week ? 7 : 1;
  const title = week
    ? `${formatShortDate(from)} – ${formatShortDate(addLocalDays(from, 6))}`
    : formatLongDate(date);

  return (
    <>
      <AutoRefresh />
      <PageHeader
        title="Takvim"
        description={title}
        actions={
          canCreate && (
            <NewAppointmentDialog options={booking} defaultDate={date < today ? today : date} />
          )
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="outline"
            size="icon"
            aria-label={week ? "Önceki hafta" : "Önceki gün"}
          >
            <Link href={href({ tarih: addLocalDays(date, -step) })}>
              <ChevronLeft />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={href({ tarih: today })}>Bugün</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="icon"
            aria-label={week ? "Sonraki hafta" : "Sonraki gün"}
          >
            <Link href={href({ tarih: addLocalDays(date, step) })}>
              <ChevronRight />
            </Link>
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!scope.practitionerId && (
            <PractitionerFilter
              value={practitionerFilter ?? ""}
              options={directory.practitioners.map((p) => ({
                id: p.id,
                name: practitionerDisplayName(p),
              }))}
              hrefs={Object.fromEntries([
                ["", href({ hekim: null })],
                ...directory.practitioners.map((p) => [p.id, href({ hekim: p.id })]),
              ])}
            />
          )}
          <nav aria-label="Görünüm" className="flex rounded-full bg-hairline/70 p-1">
            {[
              ["gun", "Gün"],
              ["hafta", "Hafta"],
            ].map(([value, label]) => (
              <Link
                key={value}
                href={href({ gorunum: value })}
                aria-current={view === value ? "page" : undefined}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  view === value
                    ? "bg-paper text-heading shadow-sm shadow-ink/5"
                    : "text-body hover:text-heading",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {closures.length > 0 && (
        <ul className="flex flex-col gap-2">
          {closures.map((closure) => (
            <li
              key={closure.id}
              className="flex items-center gap-2 rounded-card-sm border border-hairline bg-paper px-4 py-2.5 text-sm text-heading"
            >
              <CalendarOff aria-hidden className="size-4 shrink-0 text-primary" />
              <span>
                {closure.practitionerId
                  ? `${practitionerDisplayName(directory.practitioners.find((p) => p.id === closure.practitionerId) ?? { name: "Hekim", title: null })} izinli`
                  : "Klinik kapalı"}
                {closure.reason && ` · ${closure.reason}`}
                <span className="text-body">
                  {" "}
                  ({closureFormat.format(closure.startsAt)} –{" "}
                  {closureFormat.format(new Date(closure.endsAt.getTime() - 1))})
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {columns.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={week ? "Bu hafta klinik kapalı" : "Tanımlı hekim yok"}
          description={
            week
              ? "Çalışma saatlerini Ayarlar'dan düzenleyebilirsiniz."
              : "Takvimin görünmesi için Ayarlar'dan hekim ekleyin."
          }
        />
      ) : (
        <ScheduleGrid
          label={week ? "Haftalık takvim" : "Günlük takvim"}
          columns={columns}
          appointments={appointments}
          range={range}
          nowMinute={showNow ? nowParts[0]! * 60 + nowParts[1]! : undefined}
        />
      )}
    </>
  );
}
