import { ChevronLeft, ChevronRight, ClipboardList, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import {
  AppointmentSourceBadge,
  AppointmentStatusBadge,
  EmptyState,
  PageHeader,
} from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/cn";
import {
  APPOINTMENT_SOURCE_LABELS,
  APPOINTMENT_SOURCES,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUSES,
} from "@/lib/contracts/appointment";
import {
  appointmentListQuerySchema,
  PERIOD_LABELS,
  type AppointmentListQuery,
} from "@/lib/contracts/panel-appointment";
import { fieldClassName } from "@/components/ui/input";
import { formatMinutes, formatShortDate } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { can, requirePanelScope } from "@/server/auth/session";
import { db } from "@/server/db";
import { listAppointments } from "@/server/domain/panel";
import { addLocalDays, isoWeekday, localToday } from "@/server/domain/time";

import { loadBookingOptions } from "./booking-options";
import { NewAppointmentDialog } from "./new-appointment-dialog";

export const metadata: Metadata = { title: "Randevular" };

const PAGE_SIZE = 25;

function periodRange(period: AppointmentListQuery["donem"], today: string) {
  switch (period) {
    case "bugun":
      return { from: today, to: addLocalDays(today, 1), order: "asc" as const };
    case "yarin":
      return { from: addLocalDays(today, 1), to: addLocalDays(today, 2), order: "asc" as const };
    case "hafta": {
      const monday = addLocalDays(today, 1 - isoWeekday(today));
      return { from: monday, to: addLocalDays(monday, 7), order: "asc" as const };
    }
    case "gecmis":
      return { from: addLocalDays(today, -365), to: today, order: "desc" as const };
    default:
      return { from: today, to: addLocalDays(today, 366), order: "asc" as const };
  }
}

export default async function AppointmentsPage({ searchParams }: PageProps<"/panel/randevular">) {
  await connection();
  const { context, scope } = await requirePanelScope({ appointments: ["read"] });
  const query = appointmentListQuerySchema.parse(await searchParams);
  const today = localToday(new Date(), context.clinic.timezone);
  const range = periodRange(query.donem, today);

  const [{ rows, total }, canCreate, booking] = await Promise.all([
    listAppointments(
      db(),
      scope,
      {
        from: range.from,
        to: range.to,
        statuses: query.durum ? [query.durum] : undefined,
        practitionerId: query.hekim,
        source: query.kaynak,
        search: query.q,
      },
      { limit: PAGE_SIZE, offset: (query.sayfa - 1) * PAGE_SIZE, order: range.order },
    ),
    can({ appointments: ["create"] }),
    loadBookingOptions(context),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const href = (
    changes: Partial<Record<keyof AppointmentListQuery, string | number | undefined>>,
  ) => {
    const params = new URLSearchParams();
    const merged = { ...query, sayfa: 1, ...changes };
    for (const [key, value] of Object.entries(merged)) {
      if (value === undefined || value === "" || (key === "sayfa" && value === 1)) continue;
      params.set(key, String(value));
    }
    const search = params.toString();
    return search ? `/panel/randevular?${search}` : "/panel/randevular";
  };
  const selectClass = cn(fieldClassName, "h-10 pr-3");

  return (
    <>
      <PageHeader
        title="Randevular"
        description={`${total} randevu`}
        actions={canCreate && <NewAppointmentDialog options={booking} />}
      />

      <nav aria-label="Dönem" className="flex flex-wrap gap-2">
        {Object.entries(PERIOD_LABELS).map(([period, label]) => {
          const active = query.donem === period;
          return (
            <Link
              key={period}
              href={href({ donem: period })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-on-dark"
                  : "border-hairline bg-paper text-body hover:text-heading",
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Plain GET form: filters live in the URL and work without JavaScript. */}
      <form
        action="/panel/randevular"
        className="grid gap-3 rounded-card border border-hairline bg-paper p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_repeat(3,11rem)_auto]"
      >
        <input type="hidden" name="donem" value={query.donem} />
        <label className="relative">
          <span className="sr-only">Hasta adı veya telefon</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-body"
          />
          <Input
            name="q"
            defaultValue={query.q}
            placeholder="Hasta adı veya telefon"
            className="h-10 pl-10"
          />
        </label>
        <label>
          <span className="sr-only">Durum</span>
          <select name="durum" defaultValue={query.durum ?? ""} className={selectClass}>
            <option value="">Tüm durumlar</option>
            {APPOINTMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {APPOINTMENT_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Hekim</span>
          <select name="hekim" defaultValue={query.hekim ?? ""} className={selectClass}>
            <option value="">Tüm hekimler</option>
            {booking.practitioners.map((practitioner) => (
              <option key={practitioner.id} value={practitioner.id}>
                {practitioner.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Kaynak</span>
          <select name="kaynak" defaultValue={query.kaynak ?? ""} className={selectClass}>
            <option value="">Tüm kaynaklar</option>
            {APPOINTMENT_SOURCES.map((source) => (
              <option key={source} value={source}>
                {APPOINTMENT_SOURCE_LABELS[source]}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="secondary" className="h-10">
          Filtrele
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Randevu bulunamadı"
          description="Filtreleri değiştirerek tekrar deneyin."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tarih</TableHead>
              <TableHead>Hasta</TableHead>
              <TableHead>Hizmet</TableHead>
              <TableHead>Hekim</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Kaynak</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className="relative">
                <TableCell className="tabular-nums">
                  <span className="font-medium">{formatShortDate(row.date)}</span>
                  <span className="block text-xs text-body">
                    {formatMinutes(row.startMinute)}–{formatMinutes(row.endMinute)}
                  </span>
                </TableCell>
                <TableCell>
                  {/* The link covers the row so the whole row is clickable. */}
                  <Link
                    href={`/panel/randevular/${row.id}`}
                    className="font-medium after:absolute after:inset-0 hover:text-primary"
                  >
                    {row.patientName}
                  </Link>
                  <span className="block text-xs text-body tabular-nums">
                    {formatPhone(row.patientPhone)}
                  </span>
                </TableCell>
                <TableCell className="text-body">{row.serviceName}</TableCell>
                <TableCell className="text-body">{row.practitionerName}</TableCell>
                <TableCell>
                  <AppointmentStatusBadge status={row.status} />
                </TableCell>
                <TableCell>
                  <AppointmentSourceBadge source={row.source} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableCaption>
            <span className="flex items-center justify-between gap-4">
              <span>
                Sayfa {query.sayfa} / {pages}
              </span>
              <span className="flex gap-2">
                <PageLink
                  href={href({ sayfa: query.sayfa - 1 })}
                  disabled={query.sayfa <= 1}
                  label="Önceki sayfa"
                >
                  <ChevronLeft />
                </PageLink>
                <PageLink
                  href={href({ sayfa: query.sayfa + 1 })}
                  disabled={query.sayfa >= pages}
                  label="Sonraki sayfa"
                >
                  <ChevronRight />
                </PageLink>
              </span>
            </span>
          </TableCaption>
        </Table>
      )}
    </>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <Button variant="outline" size="icon-sm" disabled aria-label={label}>
        {children}
      </Button>
    );
  }
  return (
    <Button asChild variant="outline" size="icon-sm">
      <Link href={href} aria-label={label}>
        {children}
      </Link>
    </Button>
  );
}
