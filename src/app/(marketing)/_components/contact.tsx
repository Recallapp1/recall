import { Clock3, Headset, ShieldCheck } from "lucide-react";

import { DemoForm } from "./demo-form";
import { SectionHeader } from "./section-header";

const promises = [
  { icon: Headset, text: "Kliniğinize özel canlı demo" },
  { icon: Clock3, text: "Kurulumu sizin yerinize biz yaparız" },
  { icon: ShieldCheck, text: "Bilgileriniz yalnızca bu talep için kullanılır" },
];

export function Contact() {
  return (
    <section
      id="iletisim"
      data-header-tone="dark"
      className="surface-dark mx-4 mt-4 scroll-mt-28 overflow-hidden rounded-section px-6 py-20 sm:mx-6 sm:px-12"
    >
      <div
        aria-hidden
        className="absolute -top-32 left-[-10%] -z-10 size-[32rem] rounded-full bg-primary opacity-30 blur-[120px]"
      />
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <div className="flex flex-col gap-8">
          <SectionHeader
            tone="dark"
            eyebrow="Demo talebi"
            title="Kliniğinizin telefonları bir daha boşta kalmasın"
            lead="Formu doldurun, kliniğinize özel asistanı birlikte deneyelim. Pilot programımıza katılan kliniklerle yakından çalışıyoruz."
          />
          <ul className="flex flex-col gap-4">
            {promises.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-on-dark-soft">
                <span className="flex size-9 items-center justify-center rounded-full bg-glass-strong">
                  <Icon aria-hidden className="size-4 text-accent" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <DemoForm />
      </div>
    </section>
  );
}
