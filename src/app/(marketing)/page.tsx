import {
  CalendarCheck,
  Headset,
  Languages,
  type LucideIcon,
  MessageSquareText,
  PhoneCall,
  ShieldCheck,
} from "lucide-react";

import {
  ActionButton,
  ActionLink,
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

const navLinks = [
  { href: "#ozellikler", label: "Özellikler" },
  { href: "#nasil-calisir", label: "Nasıl çalışır" },
  { href: "#paketler", label: "Paketler" },
];

const features: { icon: LucideIcon; label: string }[] = [
  { icon: PhoneCall, label: "7/24 her aramaya cevap" },
  { icon: CalendarCheck, label: "Gerçek takvimden randevu" },
  { icon: MessageSquareText, label: "SMS ile onay" },
  { icon: Headset, label: "Gerektiğinde ekibe aktarma" },
  { icon: Languages, label: "Doğal Türkçe konuşma" },
  { icon: ShieldCheck, label: "KVKK odaklı altyapı" },
];

const steps = [
  {
    title: "Hasta arar",
    body: "Kliniğinizin numarası Recall'a yönlenir. Asistan, kliniğinizin adıyla ve belirlediğiniz tonla karşılar.",
  },
  {
    title: "Asistan randevuyu alır",
    body: "Takviminize bakar, uygun saatleri önerir, bilgileri geri okuyup onay aldıktan sonra randevuyu oluşturur.",
  },
  {
    title: "Panelinize düşer",
    body: "Randevu anında panelinizde görünür, hastaya SMS onayı gider. Arama özeti de kaydedilir.",
  },
];

const plans = [
  { name: "Başlangıç", audience: "1–2 hekimli klinikler", minutes: "300 dakika / ay" },
  { name: "Profesyonel", audience: "3–6 hekimli klinikler", minutes: "1.000 dakika / ay" },
  { name: "Klinik+", audience: "7+ hekim, çoklu şube", minutes: "3.000 dakika / ay" },
];

export default function HomePage() {
  return (
    <PageContainer className="flex flex-col gap-4 py-4">
      <Hero />
      <Features />
      <HowItWorks />
      <Plans />
      <footer className="px-6 py-10 text-sm text-body">Recall · Pilot programı yakında</footer>
    </PageContainer>
  );
}

function Hero() {
  return (
    <SectionShell tone="dark" className="relative flex min-h-[92vh] flex-col">
      {/* Placeholder for the abstract hero image (DESIGN.md §4), pending the brand asset. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_75%_30%,var(--color-accent)_0%,transparent_70%)] opacity-20"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-b from-surface-darker/40 to-surface-darker/90"
      />
      <p
        aria-hidden
        className="pointer-events-none absolute -bottom-[4vw] left-0 -z-10 text-[22vw] text-display font-bold whitespace-nowrap text-on-dark opacity-[0.03] blur-sm select-none"
      >
        RECALL
      </p>

      <nav className="mx-auto mt-6 flex items-center gap-1 rounded-full glass-nav p-1.5">
        <span className="px-3 text-xs font-semibold text-on-dark sm:px-4 sm:text-sm">Recall</span>
        {navLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="rounded-full px-3 py-2 text-xs whitespace-nowrap text-on-dark-soft transition-colors duration-300 hover:bg-glass-strong sm:px-4 sm:text-sm"
          >
            {link.label}
          </a>
        ))}
      </nav>

      <div className="grid flex-1 items-center gap-12 px-6 py-16 sm:px-12 lg:grid-cols-[1fr_auto]">
        <FadeInUp className="flex max-w-3xl flex-col gap-8">
          <Eyebrow className="text-accent">Diş, sağlık ve güzellik klinikleri için</Eyebrow>
          <DisplayHeading as="h1" className="text-5xl sm:text-6xl lg:text-7xl">
            Telefonlarınızı açan, randevu alan Türkçe sesli asistan
          </DisplayHeading>
          <p className="max-w-xl text-lg font-light text-on-dark-muted">
            Recall kliniğinize gelen aramaları karşılar, takviminize bakarak randevu oluşturur ve
            panelinize işler. Ekibiniz telefon yerine hastalarına odaklanır.
          </p>
          <div>
            <ActionLink href="#paketler">Pilot programına katılın</ActionLink>
          </div>
        </FadeInUp>

        <FadeInUp delay={200} className="flex flex-col gap-4">
          <GlassCard className="w-72">
            <Eyebrow className="text-on-dark-muted">Canlı arama</Eyebrow>
            <p className="mt-3 text-sm text-on-dark-soft">
              “Yarın öğleden sonra diş temizliği için yer var mı?”
            </p>
            <p className="mt-2 text-sm text-on-dark">
              “Yarın saat on dört otuz uygun. Adınızı alabilir miyim?”
            </p>
          </GlassCard>
          <GlassStatCard value="7/24" description="Kaçan arama yok" />
          <GlassStatCard value="2 dk" description="Ortalama randevu süresi" />
        </FadeInUp>
      </div>
    </SectionShell>
  );
}

function Features() {
  return (
    <SectionShell
      id="ozellikler"
      tone="paper"
      className="grid gap-12 px-6 py-16 sm:px-12 lg:grid-cols-2"
    >
      <div className="flex flex-col gap-10 lg:sticky lg:top-8 lg:self-start">
        <div className="flex flex-col gap-4">
          <Eyebrow className="text-body">Özellikler</Eyebrow>
          <DisplayHeading>Sekreterinizin en yoğun işini devralır</DisplayHeading>
          <BodyText className="max-w-lg">
            Her klinik kendi hizmetleri, hekimleri, çalışma saatleri ve kurallarıyla ayrı bir
            asistana sahip olur.
          </BodyText>
        </div>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3">
          {features.map(({ icon: Icon, label }) => (
            <li key={label} className="flex flex-col gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-canvas">
                <Icon aria-hidden className="size-4 text-heading" />
              </span>
              <span className="text-sm font-medium">{label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="group surface-dark relative min-h-[28rem] overflow-hidden rounded-bento p-6">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_30%_20%,var(--color-accent)_0%,transparent_70%)] opacity-15 transition-transform duration-300 group-hover:scale-105"
        />
        <GlassCard className="absolute right-6 bottom-6 left-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <Eyebrow className="text-on-dark-muted">Bugün</Eyebrow>
            <span className="flex items-center gap-2 text-xs text-on-dark-soft">
              <span aria-hidden className="size-2 rounded-full bg-accent" /> Asistan aktif
            </span>
          </div>
          {[
            { label: "Cevaplanan aramalar", value: 92 },
            { label: "Randevuya dönüşen", value: 74 },
            { label: "Ekibe aktarılan", value: 8 },
          ].map((row) => (
            <div key={row.label} className="flex flex-col gap-2">
              <div className="flex justify-between text-sm text-on-dark-soft">
                <span>{row.label}</span>
                <span>%{row.value}</span>
              </div>
              <div className="h-1.5 rounded-full bg-glass-strong">
                <div className="h-full rounded-full bg-accent" style={{ width: `${row.value}%` }} />
              </div>
            </div>
          ))}
        </GlassCard>
      </div>
    </SectionShell>
  );
}

function HowItWorks() {
  return (
    <SectionShell
      id="nasil-calisir"
      tone="dark"
      className="relative grid gap-12 px-6 py-16 sm:px-12 lg:grid-cols-2"
    >
      {/* Grayscale grid line-art overlay (DESIGN.md §4). */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(var(--color-glass-border)_1px,transparent_1px),linear-gradient(90deg,var(--color-glass-border)_1px,transparent_1px)] bg-[size:48px_48px] opacity-40"
      />
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <Eyebrow className="text-accent">Nasıl çalışır</Eyebrow>
          <DisplayHeading>Arama, randevu, panel. Üç adım.</DisplayHeading>
        </div>
        <ol className="flex flex-col gap-4">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-5 rounded-2xl glass p-5">
              <span className="text-2xl text-display font-semibold text-accent">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="font-medium text-on-dark">{step.title}</h3>
                <p className="text-sm text-on-dark-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="relative flex items-center justify-center py-8 [perspective:1200px]">
        <div className="w-full max-w-md [transform:rotateY(-3deg)_rotate(3deg)] rounded-card glass p-5 shadow-2xl">
          <div className="mb-4 flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-glass-strong" />
            <span className="size-2.5 rounded-full bg-glass-strong" />
            <span className="size-2.5 rounded-full bg-glass-strong" />
          </div>
          <div className="flex flex-col gap-3 font-mono text-xs">
            <p className="text-on-dark-muted">hasta › yarın temizlik için randevu</p>
            <p className="rounded-card-sm glass p-3 text-on-dark-soft">
              check_availability(<span className="text-accent">&quot;yarın&quot;</span>)
            </p>
            <p className="text-on-dark-muted">asistan › on dört otuz uygun, adınız?</p>
            <p className="rounded-card-sm glass p-3 text-on-dark-soft">
              book_appointment(<span className="text-accent">ok: true</span>)
            </p>
          </div>
        </div>
        <StatusTag className="absolute right-4 bottom-4">Randevu oluşturuldu</StatusTag>
      </div>
    </SectionShell>
  );
}

function Plans() {
  return (
    <SectionShell id="paketler" tone="light" className="flex flex-col gap-10 px-6 py-16 sm:px-12">
      <div className="flex flex-col gap-4">
        <Eyebrow className="text-body">Paketler</Eyebrow>
        <DisplayHeading>Kliniğinizin büyüklüğüne göre</DisplayHeading>
        <BodyText>Fiyatlar pilot dönemin ardından açıklanacak.</BodyText>
      </div>
      <ul className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <li
            key={plan.name}
            className="flex flex-col overflow-hidden rounded-bento border border-hairline bg-paper"
          >
            <div aria-hidden className="h-16 bg-gradient-to-b from-surface-dark to-ink" />
            <div className="flex flex-1 flex-col gap-4 p-6">
              <div className="flex flex-col gap-1">
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <p className="text-sm text-body">{plan.audience}</p>
              </div>
              <p className="text-sm font-medium">{plan.minutes}</p>
              <ActionButton className="mt-auto w-full justify-between border border-hairline">
                Bilgi alın
              </ActionButton>
            </div>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
