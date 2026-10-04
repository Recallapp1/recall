import { CalendarCheck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import {
  ActionButton,
  BodyText,
  DisplayHeading,
  Eyebrow,
  FadeInUp,
  GlassCard,
  GlassStatCard,
  PageContainer,
  SectionShell,
  StatusTag,
} from "@/components/design";
import { env } from "@/lib/env";

import { PanelShowcase } from "./panel-showcase";

export const metadata: Metadata = { title: "Tasarım sistemi", robots: { index: false } };

const swatches = [
  { name: "ink", note: "En koyu lacivert · footer", className: "bg-ink" },
  { name: "surface-dark", note: "Lacivert · koyu bölümler", className: "bg-surface-dark" },
  { name: "surface-raised", note: "Koyu zeminde kart", className: "bg-surface-raised" },
  { name: "primary", note: "Buton ve link · mavi", className: "bg-primary" },
  { name: "primary-soft", note: "Açık zeminde ikon zemini", className: "bg-primary-soft" },
  { name: "accent", note: "Yalnızca koyu zeminde vurgu", className: "bg-accent" },
  { name: "canvas", note: "Sayfa zemini · soğuk beyaz", className: "bg-canvas" },
  { name: "paper", note: "Kart ve açık bölüm · beyaz", className: "bg-paper" },
  { name: "heading", note: "Başlık metni", className: "bg-heading" },
  { name: "body", note: "Gövde metni (7,6:1)", className: "bg-body" },
  { name: "success", note: "Olumlu durum", className: "bg-success" },
  { name: "success-soft", note: "Olumlu rozet zemini", className: "bg-success-soft" },
  { name: "danger", note: "Hata ve yıkıcı eylem (panel)", className: "bg-danger" },
  { name: "danger-soft", note: "Hata rozeti / uyarı zemini", className: "bg-danger-soft" },
  { name: "hairline", note: "Kenarlık ve ayırıcı", className: "bg-hairline" },
];

const radii = [
  { name: "section · 2.5rem", className: "rounded-section" },
  { name: "bento · 2rem", className: "rounded-bento" },
  { name: "card · 1.5rem", className: "rounded-card" },
  { name: "card-sm · 1rem", className: "rounded-card-sm" },
  { name: "full", className: "rounded-full" },
];

/** Living style guide for DESIGN.md (development only). */
export default async function DesignSystemPage() {
  await connection();
  if (env().NODE_ENV === "production") notFound();

  return (
    <PageContainer className="flex flex-col gap-6 py-6">
      <SectionShell tone="dark" className="px-6 py-16 sm:px-12">
        <FadeInUp className="flex flex-col gap-6">
          <Eyebrow className="text-accent">Recall · Tasarım sistemi</Eyebrow>
          <DisplayHeading as="h1" className="max-w-3xl">
            DESIGN.md bileşenleri ve token&apos;ları
          </DisplayHeading>
          <p className="max-w-2xl text-on-dark-muted">
            Koyu bölüm: lacivert, alttan koyulaşan gradyan ve hafif grain. Kaynak: DESIGN.md
            (ADR-005, ADR-007).
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <ActionButton>Demo talep et</ActionButton>
            <ActionButton icon={CalendarCheck} variant="primary">
              Randevu oluştur
            </ActionButton>
            <StatusTag>Asistan aktif</StatusTag>
          </div>
        </FadeInUp>
        <FadeInUp delay={150} className="mt-12 flex flex-wrap gap-4">
          <GlassStatCard value="%72" description="İnsana devretmeden tamamlanan aramalar" />
          <GlassStatCard value="1,4 sn" description="Ortalama yanıt süresi" />
          <GlassCard className="w-72">
            <Eyebrow className="text-on-dark-muted">Cam kart</Eyebrow>
            <p className="mt-3 text-sm text-on-dark-soft">
              5% beyaz, 12px blur, 1px %10 beyaz kenarlık.
            </p>
          </GlassCard>
        </FadeInUp>
      </SectionShell>

      <SectionShell tone="paper" className="grid gap-10 px-6 py-12 sm:px-12 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Eyebrow className="text-body">Renkler</Eyebrow>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {swatches.map((swatch) => (
              <li key={swatch.name} className="flex flex-col gap-2">
                <span
                  className={`h-16 rounded-card-sm border border-hairline ${swatch.className}`}
                />
                <span className="text-sm font-medium">{swatch.name}</span>
                <span className="text-xs text-body">{swatch.note}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-4">
          <Eyebrow className="text-body">Tipografi</Eyebrow>
          <DisplayHeading>Başlık · display</DisplayHeading>
          <BodyText>
            Gövde metni: Montserrat 400, `body` token (7,6:1). Türkçe karakterler: ğüşıöç ĞÜŞİÖÇ.
          </BodyText>
          <Eyebrow className="text-heading">Etiket · 10px · 0.2em</Eyebrow>
        </div>
      </SectionShell>

      <SectionShell tone="light" className="px-6 py-12 sm:px-12">
        <Eyebrow className="text-body">Köşe yarıçapları</Eyebrow>
        <ul className="mt-4 flex flex-wrap gap-4">
          {radii.map((radius) => (
            <li
              key={radius.name}
              className={`flex h-24 w-40 items-end border border-hairline bg-paper p-3 text-xs text-body ${radius.className}`}
            >
              {radius.name}
            </li>
          ))}
        </ul>
      </SectionShell>

      <SectionShell tone="light" className="px-6 py-12 sm:px-12">
        <Eyebrow className="text-primary">Panel bileşenleri · F4.2</Eyebrow>
        <p className="mt-2 mb-8 max-w-2xl text-sm text-body">
          shadcn/ui (Radix) tabanlı, DESIGN.md token&apos;larıyla yeniden temalandı. Türetmeler
          docs/04-panel/DESIGN-SYSTEM.md §3&apos;te; F5 öncesi ürün ekibinin onayını bekliyor.
        </p>
        <PanelShowcase />
      </SectionShell>
    </PageContainer>
  );
}
