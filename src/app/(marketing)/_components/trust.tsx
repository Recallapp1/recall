import { Check, Plus } from "lucide-react";

import { ActionLink } from "@/components/design";
import { cn } from "@/lib/cn";

import { faq, onboarding, plans, security } from "../_content";
import { SectionHeader } from "./section-header";

export function Security() {
  return (
    <section
      id="guvenlik"
      className="surface-dark mx-4 scroll-mt-28 overflow-hidden rounded-section px-6 py-20 sm:mx-6 sm:px-12"
    >
      <div
        aria-hidden
        className="absolute right-[-10%] bottom-[-20%] -z-10 size-[28rem] rounded-full bg-primary opacity-25 blur-[120px]"
      />
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_1.4fr]">
        <SectionHeader
          tone="dark"
          eyebrow="Güvenlik ve KVKK"
          title="Hasta verisi için tasarlandı"
          lead="Sağlık verisi özel nitelikli kişisel veridir. Recall'un altyapısı ilk günden bu hassasiyetle kuruldu."
          className="lg:sticky lg:top-32 lg:self-start"
        />
        <ul className="grid gap-4 sm:grid-cols-2">
          {security.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex flex-col gap-3 rounded-card glass p-6">
              <Icon aria-hidden className="size-6 text-accent" />
              <h3 className="font-semibold text-on-dark">{title}</h3>
              <p className="text-sm leading-relaxed text-on-dark-muted">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Onboarding() {
  return (
    <section className="px-4 py-20 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-12">
        <SectionHeader
          eyebrow="Kurulum"
          title="Kurulumu sizin yerinize biz yapıyoruz"
          lead="Teknik bilgi gerekmez. Asistanınızı kliniğinize göre hazırlar, birlikte test eder ve canlıya alırız."
        />
        <ol className="grid gap-4 md:grid-cols-4">
          {onboarding.map(({ icon: Icon, title, body }, index) => (
            <li
              key={title}
              className="flex flex-col gap-4 rounded-card border border-hairline bg-paper p-6"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-card-sm bg-primary-soft">
                  <Icon aria-hidden className="size-5 text-primary" />
                </span>
                <span className="text-label text-body">Adım {index + 1}</span>
              </div>
              <h3 className="font-semibold text-heading">{title}</h3>
              <p className="text-sm leading-relaxed text-body">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Pricing() {
  return (
    <section
      id="paketler"
      className="mx-4 scroll-mt-28 rounded-section bg-paper px-6 py-20 sm:mx-6 sm:px-12"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-12">
        <SectionHeader
          eyebrow="Paketler"
          title="Kliniğinizin büyüklüğüne göre"
          lead="Fiyatlar pilot programın ardından açıklanacak. Pilot programına katılmak için bize ulaşın."
          align="center"
        />
        <ul className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <li
              key={plan.name}
              className={cn(
                "relative flex flex-col gap-6 rounded-bento p-8",
                plan.featured
                  ? "surface-dark shadow-2xl shadow-ink/20"
                  : "border border-hairline bg-canvas",
              )}
            >
              {plan.featured && (
                <span className="absolute top-6 right-6 rounded-full bg-primary px-3 py-1 text-xs font-medium text-on-dark">
                  Önerilen
                </span>
              )}
              <div className="flex flex-col gap-1">
                <h3
                  className={cn(
                    "text-xl font-semibold",
                    plan.featured ? "text-on-dark" : "text-heading",
                  )}
                >
                  {plan.name}
                </h3>
                <p className={cn("text-sm", plan.featured ? "text-on-dark-muted" : "text-body")}>
                  {plan.audience}
                </p>
              </div>
              <ul className="flex flex-col gap-3">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className={cn(
                      "flex items-center gap-3 text-sm",
                      plan.featured ? "text-on-dark-soft" : "text-heading",
                    )}
                  >
                    <Check
                      aria-hidden
                      className={cn("size-4", plan.featured ? "text-accent" : "text-primary")}
                    />
                    {feature}
                  </li>
                ))}
              </ul>
              <ActionLink
                href="#iletisim"
                variant={plan.featured ? "onDark" : "primary"}
                className="mt-auto w-full"
              >
                Bilgi alın
              </ActionLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Faq() {
  return (
    <section id="sss" className="scroll-mt-28 px-4 py-20 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_1.6fr]">
        <SectionHeader
          eyebrow="Sıkça sorulan sorular"
          title="Merak edilenler"
          lead="Aradığınız cevabı bulamazsanız bize yazın; size dönelim."
        />
        <ul className="flex flex-col gap-3">
          {faq.map((item) => (
            <li key={item.q}>
              <details className="group rounded-card border border-hairline bg-paper px-6 py-5 open:shadow-lg open:shadow-ink/5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-heading [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <Plus
                    aria-hidden
                    className="size-5 shrink-0 text-primary transition-transform duration-300 group-open:rotate-45"
                  />
                </summary>
                <p className="mt-4 leading-relaxed text-body">{item.a}</p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
