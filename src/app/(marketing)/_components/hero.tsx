import { CalendarCheck, CheckCircle2, MessageSquareText, PhoneCall } from "lucide-react";

import { ActionLink, Eyebrow, FadeInUp, GlassCard, SecondaryLink } from "@/components/design";

import { hero } from "../_content";

// Static bar heights for the waveform illustration.
const WAVE = [6, 14, 22, 12, 28, 18, 34, 20, 26, 10, 30, 16, 24, 8, 18, 28, 12, 22, 14, 6];

export function Hero() {
  return (
    <section className="surface-dark relative overflow-hidden rounded-b-section px-4 pt-32 pb-20 sm:px-6 lg:pt-40 lg:pb-28">
      {/* Soft blue light from the top right; depth without a photo. */}
      <div
        aria-hidden
        className="absolute -top-40 right-[-10%] -z-10 size-[42rem] rounded-full bg-primary opacity-30 blur-[120px]"
      />
      <div
        aria-hidden
        className="absolute bottom-[-30%] left-[-10%] -z-10 size-[30rem] rounded-full bg-accent opacity-10 blur-[120px]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(var(--color-glass-border)_1px,transparent_1px),linear-gradient(90deg,var(--color-glass-border)_1px,transparent_1px)] mask-[radial-gradient(ellipse_at_center,black_20%,transparent_70%)] bg-size-[56px_56px] opacity-40"
      />

      <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1.1fr_1fr]">
        <FadeInUp className="flex flex-col gap-8">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-glass-border bg-glass px-4 py-1.5">
            <span aria-hidden className="size-1.5 rounded-full bg-accent" />
            <Eyebrow className="text-on-dark-soft">{hero.eyebrow}</Eyebrow>
          </span>

          <h1 className="text-5xl text-display font-semibold text-balance text-on-dark sm:text-6xl lg:text-7xl">
            {hero.title}
          </h1>

          <p className="max-w-xl text-lg leading-relaxed text-on-dark-muted sm:text-xl">
            {hero.lead}
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <ActionLink href="#iletisim">Demo talep edin</ActionLink>
            <SecondaryLink href="#nasil-calisir">Nasıl çalışır?</SecondaryLink>
          </div>

          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-on-dark-soft">
            {hero.highlights.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCircle2 aria-hidden className="size-4 text-accent" />
                {item}
              </li>
            ))}
          </ul>
        </FadeInUp>

        <FadeInUp delay={200} className="relative">
          <CallIllustration />
        </FadeInUp>
      </div>
    </section>
  );
}

function CallIllustration() {
  return (
    <figure aria-label="Örnek arama görünümü" className="relative mx-auto w-full max-w-md">
      <GlassCard className="flex flex-col gap-6 rounded-bento bg-surface-raised/60 p-6 shadow-2xl shadow-ink/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-primary">
              <PhoneCall aria-hidden className="size-5" />
            </span>
            <div>
              <p className="text-sm font-medium">Gelen arama</p>
              <p className="text-xs text-on-dark-muted">Gülüş Diş Kliniği · 00:42</p>
            </div>
          </div>
          <span className="flex items-center gap-2 rounded-full bg-glass-strong px-3 py-1 text-xs">
            <span aria-hidden className="size-2 animate-pulse rounded-full bg-accent" />
            Canlı
          </span>
        </div>

        <div aria-hidden className="flex h-10 items-center justify-between gap-1">
          {WAVE.map((height, index) => (
            <span
              key={index}
              className="w-1.5 rounded-full bg-accent/70"
              style={{ height: `${height}px` }}
            />
          ))}
        </div>

        <div className="flex flex-col gap-3 text-sm">
          <p className="max-w-[85%] self-end rounded-card-sm rounded-br-sm bg-glass-strong px-4 py-3 text-on-dark-soft">
            Yarın öğleden sonra diş temizliği için yer var mı?
          </p>
          <p className="max-w-[85%] rounded-card-sm rounded-bl-sm bg-primary px-4 py-3">
            Yarın saat on dört otuz uygun. Adınızı alabilir miyim?
          </p>
        </div>
      </GlassCard>

      <div className="absolute -bottom-10 -left-4 flex w-64 items-start gap-3 rounded-card bg-paper p-4 text-heading shadow-2xl shadow-ink/40 sm:-left-12">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft">
          <CalendarCheck aria-hidden className="size-4 text-primary" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold">Randevu oluşturuldu</p>
          <p className="text-xs text-body">Diş taşı temizliği · Yarın 14:30</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-success">
            <MessageSquareText aria-hidden className="size-3.5" />
            SMS onayı gönderildi
          </p>
        </div>
      </div>
    </figure>
  );
}
