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

export const metadata: Metadata = { title: "Tasarım sistemi", robots: { index: false } };

const swatches = [
  { name: "ink", note: "Primary Dark · siyah", className: "bg-ink" },
  { name: "surface-dark", note: "Dark Surface · Zinc-900", className: "bg-surface-dark" },
  { name: "canvas", note: "Light Background · Zinc-100", className: "bg-canvas" },
  { name: "paper", note: "Kart zemini · beyaz", className: "bg-paper" },
  { name: "accent", note: "Accent · Emerald-400", className: "bg-accent" },
  { name: "body", note: "Gövde metni · Zinc-500", className: "bg-body" },
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
            Koyu bölüm: alttan ağırlıklı gradyan ve %15 grain. Kaynak: DESIGN.md, ADR-005.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <ActionButton>Demo talep et</ActionButton>
            <ActionButton icon={CalendarCheck}>Randevu oluştur</ActionButton>
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
            Gövde metni: 300–400 ağırlık, Zinc-500. Türkçe karakterler: ğüşıöç ĞÜŞİÖÇ.
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
    </PageContainer>
  );
}
