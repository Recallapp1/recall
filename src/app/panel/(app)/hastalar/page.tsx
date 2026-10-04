import { ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { z } from "zod";

import { EmptyState, PageHeader } from "@/components/panel";
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
import { formatPhone } from "@/lib/phone";
import { requirePanelScope } from "@/server/auth/session";
import { db } from "@/server/db";
import { listPatients } from "@/server/domain/panel";

export const metadata: Metadata = { title: "Hastalar" };

const PAGE_SIZE = 25;
const querySchema = z.object({
  q: z.string().trim().max(60).optional().catch(undefined),
  sayfa: z.coerce.number().int().min(1).max(500).catch(1),
  durum: z.string().optional().catch(undefined),
});

export default async function PatientsPage({ searchParams }: PageProps<"/panel/hastalar">) {
  await connection();
  const { context, scope } = await requirePanelScope({ patients: ["read"] });
  const query = querySchema.parse(await searchParams);
  const { rows, total } = await listPatients(db(), scope, {
    search: query.q,
    limit: PAGE_SIZE,
    offset: (query.sayfa - 1) * PAGE_SIZE,
    now: new Date(),
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const date = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: context.clinic.timezone,
  });
  const pageHref = (sayfa: number) => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (sayfa > 1) params.set("sayfa", String(sayfa));
    const search = params.toString();
    return search ? `/panel/hastalar?${search}` : "/panel/hastalar";
  };

  return (
    <>
      <PageHeader title="Hastalar" description={`${total} hasta`} />
      {query.durum === "anonimlestirildi" && (
        <p role="status" className="rounded-card-sm bg-success-soft px-4 py-3 text-sm text-success">
          Hastanın kişisel verileri anonimleştirildi.
        </p>
      )}
      <form action="/panel/hastalar" className="flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Hasta adı veya telefon</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-body"
          />
          <Input
            name="q"
            defaultValue={query.q}
            placeholder="Hasta adı veya telefon"
            className="pl-10"
          />
        </label>
        <Button type="submit" variant="secondary" size="lg">
          Ara
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={query.q ? "Eşleşen hasta yok" : "Henüz hasta yok"}
          description="Asistanın veya ekibin randevu oluşturduğu hastalar burada listelenir."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hasta</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Randevu</TableHead>
              <TableHead>Son randevu</TableHead>
              <TableHead>Sıradaki</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className="relative">
                <TableCell>
                  <Link
                    href={`/panel/hastalar/${row.id}`}
                    className="font-medium after:absolute after:inset-0 hover:text-primary"
                  >
                    {row.fullName}
                  </Link>
                </TableCell>
                <TableCell className="text-body tabular-nums">{formatPhone(row.phone)}</TableCell>
                <TableCell className="tabular-nums">{row.appointmentCount}</TableCell>
                <TableCell className="text-body">
                  {row.lastAppointmentAt ? date.format(row.lastAppointmentAt) : "—"}
                </TableCell>
                <TableCell className="text-body">
                  {row.nextAppointmentAt ? date.format(row.nextAppointmentAt) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {pages > 1 && (
            <TableCaption>
              <span className="flex items-center justify-between gap-4">
                <span>
                  Sayfa {query.sayfa} / {pages}
                </span>
                <span className="flex gap-2">
                  {query.sayfa > 1 && (
                    <Button asChild variant="outline" size="icon-sm">
                      <Link href={pageHref(query.sayfa - 1)} aria-label="Önceki sayfa">
                        <ChevronLeft />
                      </Link>
                    </Button>
                  )}
                  {query.sayfa < pages && (
                    <Button asChild variant="outline" size="icon-sm">
                      <Link href={pageHref(query.sayfa + 1)} aria-label="Sonraki sayfa">
                        <ChevronRight />
                      </Link>
                    </Button>
                  )}
                </span>
              </span>
            </TableCaption>
          )}
        </Table>
      )}
    </>
  );
}
