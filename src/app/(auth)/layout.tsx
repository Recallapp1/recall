import { CalendarCheck, PhoneIncoming, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/design";

export const metadata: Metadata = { robots: { index: false } };

const points = [
  { icon: PhoneIncoming, text: "Asistanın karşıladığı aramalar ve özetleri" },
  { icon: CalendarCheck, text: "Asistanın ve ekibin oluşturduğu randevular tek takvimde" },
  { icon: ShieldCheck, text: "Yalnızca kliniğinizin ekibinin erişebildiği, rol bazlı panel" },
];

/** Sign-in, password and invitation pages: navy brand panel + white form card. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas p-4 sm:p-6 lg:flex-row lg:gap-6">
      <aside
        data-header-tone="dark"
        className="surface-dark relative hidden overflow-hidden rounded-section p-12 lg:flex lg:w-[44%] lg:flex-col lg:justify-between"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-24 size-96 rounded-full bg-primary/30 blur-3xl"
        />
        <Link href="/" aria-label="Recall ana sayfa" className="relative w-fit">
          <Logo />
        </Link>
        <div className="relative flex flex-col gap-8">
          <h1 className="text-4xl text-display font-semibold xl:text-5xl">
            Kliniğinizin yeni nesil sekreteri
          </h1>
          <ul className="flex flex-col gap-4">
            {points.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-on-dark-muted">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full glass">
                  <Icon aria-hidden className="size-4 text-accent" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-on-dark-muted">
          Klinik paneli · yalnızca davetli ekip üyeleri
        </p>
      </aside>

      <main className="flex flex-1 flex-col items-center justify-center gap-8 py-10">
        <Link href="/" aria-label="Recall ana sayfa" className="lg:hidden">
          <Logo className="text-heading" />
        </Link>
        <div className="w-full max-w-md rounded-bento border border-hairline bg-paper p-6 shadow-xl shadow-ink/5 sm:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}
