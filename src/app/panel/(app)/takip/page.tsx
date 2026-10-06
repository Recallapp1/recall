import { AlertTriangle, CalendarPlus, MessageSquareOff, Phone, Repeat } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { EmptyState, PageHeader } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { FollowUpView } from "@/lib/contracts/follow-up";
import { formatShortDate } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { can, requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { listPlans, type FollowUpListRow } from "@/server/domain/follow-ups";

import { loadBookingOptions } from "../randevular/booking-options";
import { NewAppointmentDialog } from "../randevular/new-appointment-dialog";
import { FollowUpViewBadge } from "./view-badge";

export const metadata: Metadata = { title: "Takip" };

/** URL filter → the plan buckets it shows. "Yapılacaklar" is the default work list. */
const FILTERS: { slug: string; label: string; views: FollowUpView[] }[] = [
  { slug: "yapilacak", label: "Yapılacaklar", views: ["overdue", "due"] },
  { slug: "yaklasan", label: "Yaklaşan", views: ["upcoming"] },
  { slug: "randevulu", label: "Randevulu", views: ["booked"] },
  { slug: "duraklatildi", label: "Duraklatıldı", views: ["paused"] },
  { slug: "tamamlandi", label: "Tamamlandı", views: ["completed"] },
  { slug: "birakildi", label: "Bırakıldı", views: ["stopped"] },
];

export default async function FollowUpPage({ searchParams }: PageProps<"/panel/takip">) {
  await connection();
  const context = await requirePermission({ followUps: ["read"] });
  if (!context.settings.features.followUp) notFound();
  const { clinic, settings } = context;

  const slug = String((await searchParams).durum ?? "yapilacak");
  const filter = FILTERS.find((f) => f.slug === slug) ?? FILTERS[0]!;
  const [plans, canManage, canBook] = await Promise.all([
    listPlans(
      db(),
      { clinicId: clinic.id, timeZone: clinic.timezone },
      new Date(),
      settings.followUp.dueSoonDays,
    ),
    can({ followUps: ["manage"] }),
    can({ appointments: ["create"] }),
  ]);
  const booking = canBook ? await loadBookingOptions(context) : null;
  const counts = new Map(
    FILTERS.map((f) => [f.slug, plans.filter((p) => f.views.includes(p.view)).length]),
  );
  const shown = plans
    .filter((p) => filter.views.includes(p.view))
    // Overdue first within the work list.
    .sort((a, b) => Number(b.view === "overdue") - Number(a.view === "overdue"));

  return (
    <>
      <PageHeader
        title="Takip"
        description="Tekrar gelmesi gereken hastalar: zamanı gelenler, gecikenler ve randevusu olanlar"
      />
      <nav aria-label="Takip durumu" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f.slug === filter.slug;
          return (
            <Link
              key={f.slug}
              href={`/panel/takip?durum=${f.slug}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-on-dark"
                  : "border-hairline bg-paper text-body hover:text-heading",
              )}
            >
              {f.label}
              <span className={cn("tabular-nums", active ? "text-on-dark-soft" : "text-body")}>
                {counts.get(f.slug)}
              </span>
            </Link>
          );
        })}
      </nav>

      {shown.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title={filter.slug === "yapilacak" ? "Şu an aranacak hasta yok" : "Bu listede takip yok"}
          description={
            plans.length === 0
              ? "Takip, bir randevunun ya da hastanın sayfasından “Takibe al” ile başlar. Önce Ayarlar → Takip kurallarından bir kural etkinleştirin."
              : "Zamanı gelen veya geciken takipler burada listelenir."
          }
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {shown.map((plan) => (
            <PlanCard key={plan.id} plan={plan} booking={booking && canManage ? booking : null} />
          ))}
        </ul>
      )}
    </>
  );
}

function PlanCard({
  plan,
  booking,
}: {
  plan: FollowUpListRow;
  booking: Awaited<ReturnType<typeof loadBookingOptions>> | null;
}) {
  const progress = plan.totalVisits
    ? `${plan.visitsDone} / ${plan.totalVisits} ziyaret`
    : `${plan.visitsDone} ziyaret`;
  return (
    <li className="flex flex-col gap-3 rounded-card border border-hairline bg-paper p-5">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/panel/takip/${plan.id}`}
          className="flex min-w-0 flex-col gap-0.5 hover:underline"
        >
          <span className="font-semibold text-heading">{plan.patientName}</span>
          <span className="text-xs text-body">
            {plan.name} · {progress}
          </span>
        </Link>
        <FollowUpViewBadge view={plan.view} />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {plan.view === "booked" && plan.bookedAt ? (
          <span className="text-heading">
            Randevu:{" "}
            {new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long" }).format(
              plan.bookedAt,
            )}
          </span>
        ) : plan.nextDueOn ? (
          <span className={cn(plan.view === "overdue" ? "text-danger" : "text-heading")}>
            {plan.view === "overdue" ? "Tarihi geçti: " : "Sonraki: "}
            {formatShortDate(plan.nextDueOn)}
          </span>
        ) : null}
        {plan.needsReview && (
          <Badge variant="destructive">
            <AlertTriangle aria-hidden />
            Eşleştirme bekliyor
          </Badge>
        )}
        {!plan.smsConsent && (
          <Badge variant="secondary" title="SMS onayı yok: hasta aranarak hatırlatılır">
            <MessageSquareOff aria-hidden />
            SMS yok
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
        <Button asChild variant="outline" size="sm">
          <a href={`tel:${plan.patientPhone}`}>
            <Phone data-icon="inline-start" />
            <span className="tabular-nums">{formatPhone(plan.patientPhone)}</span>
          </a>
        </Button>
        {booking &&
          (plan.view === "due" || plan.view === "overdue" || plan.view === "upcoming") && (
            <NewAppointmentDialog
              options={booking}
              prefill={{
                serviceId: plan.visitServiceId,
                patientName: plan.patientName,
                patientPhone: formatPhone(plan.patientPhone),
              }}
              trigger={
                <Button size="sm">
                  <CalendarPlus data-icon="inline-start" />
                  Randevu oluştur
                </Button>
              }
            />
          )}
        <Button asChild variant="ghost" size="sm" className="ml-auto">
          <Link href={`/panel/takip/${plan.id}`}>Ayrıntı</Link>
        </Button>
      </div>
    </li>
  );
}
