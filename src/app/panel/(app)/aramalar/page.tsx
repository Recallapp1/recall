import { ChevronLeft, ChevronRight, PhoneCall } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { z } from "zod";

import { CallFlagBadges, EmptyState, OutcomeBadge, PageHeader } from "@/components/panel";
import { Button } from "@/components/ui/button";
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
import { CALL_OUTCOME_LABELS, CALL_OUTCOMES, formatDuration } from "@/lib/contracts/call";
import { maskPhone } from "@/lib/phone";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { listCalls } from "@/server/domain/panel";

export const metadata: Metadata = { title: "Aramalar" };

const PAGE_SIZE = 25;
const querySchema = z.object({
  sonuc: z.enum(CALL_OUTCOMES).optional().catch(undefined),
  sayfa: z.coerce.number().int().min(1).max(500).catch(1),
});

export default async function CallsPage({ searchParams }: PageProps<"/panel/aramalar">) {
  await connection();
  const { clinic } = await requirePermission({ calls: ["read"] });
  const query = querySchema.parse(await searchParams);
  const { rows, total } = await listCalls(db(), clinic.id, {
    outcome: query.sonuc,
    limit: PAGE_SIZE,
    offset: (query.sayfa - 1) * PAGE_SIZE,
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const time = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: clinic.timezone,
  });
  const href = (changes: { sonuc?: string | null; sayfa?: number }) => {
    const params = new URLSearchParams();
    const sonuc = changes.sonuc === null ? undefined : (changes.sonuc ?? query.sonuc);
    if (sonuc) params.set("sonuc", sonuc);
    const sayfa = changes.sayfa ?? 1;
    if (sayfa > 1) params.set("sayfa", String(sayfa));
    const search = params.toString();
    return search ? `/panel/aramalar?${search}` : "/panel/aramalar";
  };

  return (
    <>
      <PageHeader title="Aramalar" description={`Asistanın karşıladığı ${total} arama`} />
      <nav aria-label="Sonuç" className="flex flex-wrap gap-2">
        {[
          { value: null, label: "Tümü" },
          ...CALL_OUTCOMES.map((value) => ({ value, label: CALL_OUTCOME_LABELS[value] })),
        ].map(({ value, label }) => {
          const active = (query.sonuc ?? null) === value;
          return (
            <Link
              key={label}
              href={href({ sonuc: value })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
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

      {rows.length === 0 ? (
        <EmptyState
          icon={PhoneCall}
          title="Arama yok"
          description="Asistanın karşıladığı aramalar özetleriyle birlikte burada listelenir."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Zaman</TableHead>
              <TableHead>Arayan</TableHead>
              <TableHead>Sonuç</TableHead>
              <TableHead>Süre</TableHead>
              <TableHead>Özet</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className="relative">
                <TableCell className="tabular-nums">
                  {time.format(row.startedAt ?? row.createdAt)}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/panel/aramalar/${row.id}`}
                    className="font-medium after:absolute after:inset-0 hover:text-primary"
                  >
                    {row.patientName ?? "Kayıtlı olmayan arayan"}
                  </Link>
                  <span className="block text-xs text-body tabular-nums">
                    {maskPhone(row.fromNumber)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="inline-flex flex-wrap gap-1">
                    <OutcomeBadge outcome={row.outcome} />
                    <CallFlagBadges flags={row.flags} />
                  </span>
                </TableCell>
                <TableCell className="text-body tabular-nums">
                  {formatDuration(row.durationSeconds)}
                </TableCell>
                <TableCell className="max-w-md truncate text-body">{row.summary ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableCaption>
            <span className="flex items-center justify-between gap-4">
              <span>
                Sayfa {query.sayfa} / {pages}
              </span>
              <span className="flex gap-2">
                <Button
                  asChild={query.sayfa > 1}
                  variant="outline"
                  size="icon-sm"
                  disabled={query.sayfa <= 1}
                  aria-label="Önceki sayfa"
                >
                  {query.sayfa > 1 ? (
                    <Link href={href({ sayfa: query.sayfa - 1 })}>
                      <ChevronLeft />
                    </Link>
                  ) : (
                    <ChevronLeft />
                  )}
                </Button>
                <Button
                  asChild={query.sayfa < pages}
                  variant="outline"
                  size="icon-sm"
                  disabled={query.sayfa >= pages}
                  aria-label="Sonraki sayfa"
                >
                  {query.sayfa < pages ? (
                    <Link href={href({ sayfa: query.sayfa + 1 })}>
                      <ChevronRight />
                    </Link>
                  ) : (
                    <ChevronRight />
                  )}
                </Button>
              </span>
            </span>
          </TableCaption>
        </Table>
      )}
    </>
  );
}
