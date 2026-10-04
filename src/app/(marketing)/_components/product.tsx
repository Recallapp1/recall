import {
  CalendarDays,
  Check,
  LayoutDashboard,
  ListChecks,
  Mic,
  PhoneCall,
  PhoneForwarded,
  ShieldCheck,
} from "lucide-react";

import { cn } from "@/lib/cn";

import { assistantPrinciples, conversation } from "../_content";
import { SectionHeader } from "./section-header";

export function Conversation() {
  return (
    <section className="px-4 py-20 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div className="flex flex-col gap-8">
          <SectionHeader
            eyebrow="Örnek görüşme"
            title="Doğal, kısa ve her zaman teyitli"
            lead="Asistan hastayı dinler, takvime bakar ve bir işlem yapmadan önce bilgileri geri okuyup onay alır."
          />
          <ul className="flex flex-col gap-3">
            {assistantPrinciples.map((principle) => (
              <li key={principle} className="flex items-start gap-3 text-heading">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft">
                  <ShieldCheck aria-hidden className="size-3 text-primary" />
                </span>
                <span className="text-sm font-medium">{principle}</span>
              </li>
            ))}
          </ul>
        </div>

        <figure
          aria-label="Örnek görüşme dökümü"
          className="flex flex-col gap-3 rounded-bento border border-hairline bg-paper p-6 shadow-xl shadow-ink/5 sm:p-8"
        >
          <figcaption className="mb-2 flex items-center gap-3 border-b border-hairline pb-4">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary">
              <Mic aria-hidden className="size-4 text-on-dark" />
            </span>
            <span className="text-sm font-semibold text-heading">Gülüş Diş Kliniği · Asistan</span>
          </figcaption>
          {conversation.map((line, index) => (
            <div
              key={index}
              className={cn(
                "flex max-w-[88%] flex-col gap-1",
                line.speaker === "patient" && "items-end self-end",
              )}
            >
              <p
                className={cn(
                  "rounded-card-sm px-4 py-3 text-sm leading-relaxed",
                  line.speaker === "assistant"
                    ? "rounded-bl-sm bg-surface-dark text-on-dark"
                    : "rounded-br-sm bg-canvas text-heading",
                )}
              >
                {line.text}
              </p>
              {line.note && (
                <span className="flex items-center gap-1 text-xs font-medium text-success">
                  <Check aria-hidden className="size-3.5" />
                  {line.note}
                </span>
              )}
            </div>
          ))}
        </figure>
      </div>
    </section>
  );
}

const sampleAppointments = [
  { time: "09:00", patient: "A. Y.", service: "Muayene", source: "Asistan" },
  { time: "10:30", patient: "M. K.", service: "Diş taşı temizliği", source: "Asistan" },
  { time: "11:15", patient: "S. D.", service: "Dolgu", source: "Panel" },
  { time: "14:30", patient: "E. A.", service: "Kanal tedavisi", source: "Asistan" },
];

const panelPoints = [
  { icon: CalendarDays, text: "Hekim bazında günlük ve haftalık takvim" },
  { icon: PhoneCall, text: "Her aramanın sonucu ve Türkçe özeti" },
  { icon: PhoneForwarded, text: "Geri aranacak hastaların listesi" },
  { icon: ListChecks, text: "Ekibiniz için rol bazlı erişim" },
];

export function PanelPreview() {
  return (
    <section className="mx-4 rounded-section bg-paper px-6 py-20 sm:mx-6 sm:px-12">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_1.3fr] lg:items-center">
        <div className="flex flex-col gap-8">
          <SectionHeader
            eyebrow="Klinik paneli"
            title="Tüm randevular tek ekranda"
            lead="Asistanın aldığı randevular anında panelinize düşer. Ekibiniz günü tek bakışta görür."
          />
          <ul className="flex flex-col gap-4">
            {panelPoints.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-card-sm bg-primary-soft">
                  <Icon aria-hidden className="size-4 text-primary" />
                </span>
                <span className="text-sm font-medium text-heading">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <figure
          aria-label="Örnek panel görünümü"
          className="overflow-hidden rounded-bento border border-hairline bg-canvas shadow-xl shadow-ink/5"
        >
          <div className="flex items-center gap-2 border-b border-hairline bg-paper px-5 py-3">
            <LayoutDashboard aria-hidden className="size-4 text-primary" />
            <span className="text-sm font-semibold text-heading">Bugün</span>
            <span className="ml-auto text-xs text-body">Örnek görünüm</span>
          </div>
          <div className="grid gap-4 p-5">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Randevu", value: "12" },
                { label: "Asistandan", value: "8" },
                { label: "Geri arama", value: "2" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-card-sm border border-hairline bg-paper p-3"
                >
                  <p className="text-xs text-body">{stat.label}</p>
                  <p className="text-2xl text-display font-semibold text-heading">{stat.value}</p>
                </div>
              ))}
            </div>
            <ul className="divide-y divide-hairline rounded-card-sm border border-hairline bg-paper">
              {sampleAppointments.map((row) => (
                <li key={row.time} className="flex items-center gap-4 px-4 py-3 text-sm">
                  <span className="w-12 font-semibold text-heading tabular-nums">{row.time}</span>
                  <span className="flex-1 text-heading">
                    {row.service}
                    <span className="ml-2 text-xs text-body">{row.patient}</span>
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      row.source === "Asistan"
                        ? "bg-primary-soft text-primary"
                        : "border border-hairline text-body",
                    )}
                  >
                    {row.source}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </figure>
      </div>
    </section>
  );
}
