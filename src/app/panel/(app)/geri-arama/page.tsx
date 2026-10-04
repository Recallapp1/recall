import { Phone, PhoneCall, PhoneForwarded } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { EmptyState, PageHeader } from "@/components/panel";
import { cn } from "@/lib/cn";
import { formatRelative } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { can, requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { listCallbacks } from "@/server/domain/panel";

import { CallbackButton } from "./callback-button";

export const metadata: Metadata = { title: "Geri aranacaklar" };

export default async function CallbacksPage({ searchParams }: PageProps<"/panel/geri-arama">) {
  await connection();
  const { clinic } = await requirePermission({ callbacks: ["read"] });
  const done = (await searchParams).durum === "tamamlanan";
  const [items, canUpdate, canSeeCalls] = await Promise.all([
    listCallbacks(db(), clinic.id, done ? "done" : "open"),
    can({ callbacks: ["update"] }),
    can({ calls: ["read"] }),
  ]);
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Geri aranacaklar"
        description="Asistanın ekibe ilettiği, geri dönüş bekleyen talepler"
      />
      <nav aria-label="Durum" className="flex gap-2">
        {[
          ["/panel/geri-arama", "Bekleyen", !done],
          ["/panel/geri-arama?durum=tamamlanan", "Tamamlanan", done],
        ].map(([href, label, active]) => (
          <Link
            key={String(href)}
            href={String(href)}
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
        ))}
      </nav>

      {items.length === 0 ? (
        <EmptyState
          icon={PhoneForwarded}
          title={done ? "Tamamlanan talep yok" : "Bekleyen geri arama yok"}
          description={
            done
              ? "Arandı olarak işaretlenen talepler burada listelenir."
              : "Asistan, hekimle görüşmek isteyen veya sorusu cevaplanamayan arayanları buraya ekler."
          }
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-3 rounded-card border border-hairline bg-paper p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-semibold text-heading">
                    {item.patientName ?? "İsimsiz arayan"}
                  </span>
                  <span className="text-xs text-body">
                    {formatRelative(item.createdAt, now)}
                    {item.resolvedAt && ` · tamamlandı ${formatRelative(item.resolvedAt, now)}`}
                  </span>
                </div>
                {item.phone && (
                  <a
                    href={`tel:${item.phone}`}
                    className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary-soft px-3 py-1.5 text-sm font-medium text-primary tabular-nums hover:bg-hairline"
                  >
                    <Phone aria-hidden className="size-3.5" />
                    {formatPhone(item.phone)}
                  </a>
                )}
              </div>
              <p className="text-sm text-heading">{item.reason}</p>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-3">
                {item.callId && canSeeCalls ? (
                  <Link
                    href={`/panel/aramalar/${item.callId}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <PhoneCall aria-hidden className="size-3.5" />
                    Aramayı gör
                  </Link>
                ) : (
                  <span />
                )}
                {canUpdate && <CallbackButton callbackId={item.id} done={done} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
