import { ArrowRight } from "lucide-react";

import { clinicTypes, features, problems, steps } from "../_content";
import { SectionHeader } from "./section-header";

export function ClinicTypes() {
  return (
    <section aria-label="Hizmet verdiğimiz klinikler" className="px-4 py-16 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8">
        <p className="text-center text-sm font-medium text-body">
          Randevuyla çalışan her branştan klinik için tasarlandı
        </p>
        <ul className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {clinicTypes.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex flex-col items-center gap-3 rounded-card border border-hairline bg-paper px-4 py-5 text-center"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft">
                <Icon aria-hidden className="size-5 text-primary" />
              </span>
              <span className="text-sm font-medium text-heading">{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Problems() {
  return (
    <section className="px-4 py-20 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-12">
        <SectionHeader
          eyebrow="Neden Recall"
          title="Telefon çalıyor, ekibiniz meşgul"
          lead="Kliniğe ulaşamayan hasta çoğu zaman tekrar aramaz. Recall, telefon trafiğini sizin yerinize karşılar."
        />
        <ul className="grid gap-4 md:grid-cols-3">
          {problems.map(({ icon: Icon, title, problem, solution }) => (
            <li
              key={title}
              className="flex flex-col gap-5 rounded-bento border border-hairline bg-paper p-7"
            >
              <span className="flex size-12 items-center justify-center rounded-card-sm bg-primary-soft">
                <Icon aria-hidden className="size-5 text-primary" />
              </span>
              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-semibold text-heading">{title}</h3>
                <p className="leading-relaxed text-body">{problem}</p>
              </div>
              <p className="mt-auto flex items-start gap-2 border-t border-hairline pt-5 text-sm font-medium text-heading">
                <ArrowRight aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                {solution}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section
      id="nasil-calisir"
      className="mx-4 scroll-mt-28 rounded-section bg-paper px-6 py-20 sm:mx-6 sm:px-12"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-14">
        <SectionHeader
          eyebrow="Nasıl çalışır"
          title="Aramadan randevuya dört adım"
          lead="Hasta yalnızca konuşur; gerisini asistan halleder ve sonucu panelinize işler."
          align="center"
        />
        <ol className="relative grid gap-8 md:grid-cols-4 md:gap-6">
          {/* Connector line behind the step numbers on wide screens. */}
          <div
            aria-hidden
            className="absolute top-6 right-[12%] left-[12%] hidden h-px bg-hairline md:block"
          />
          {steps.map((step, index) => (
            <li key={step.title} className="relative flex flex-col items-center gap-4 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-primary text-lg font-semibold text-on-dark ring-8 ring-paper">
                {index + 1}
              </span>
              <h3 className="font-semibold text-heading">{step.title}</h3>
              <p className="text-sm leading-relaxed text-body">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Features() {
  return (
    <section
      id="ozellikler"
      className="surface-dark mx-4 mt-4 scroll-mt-28 overflow-hidden rounded-section px-6 py-20 sm:mx-6 sm:px-12"
    >
      <div
        aria-hidden
        className="absolute top-0 left-1/2 -z-10 h-64 w-2/3 -translate-x-1/2 rounded-full bg-primary opacity-25 blur-[100px]"
      />
      <div className="mx-auto flex max-w-6xl flex-col gap-14">
        <SectionHeader
          tone="dark"
          eyebrow="Özellikler"
          title="Bir sekreterin telefonda yaptığı her şey"
          lead="Randevu almaktan hatırlatmaya kadar rutin işler asistanda; kararlar ve hasta ilişkisi ekibinizde."
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="flex flex-col gap-4 rounded-card glass p-7 transition-colors duration-300 hover:bg-glass-strong"
            >
              <span className="flex size-11 items-center justify-center rounded-card-sm bg-primary">
                <Icon aria-hidden className="size-5 text-on-dark" />
              </span>
              <h3 className="text-lg font-semibold text-on-dark">{title}</h3>
              <p className="text-sm leading-relaxed text-on-dark-muted">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
