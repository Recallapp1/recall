import Link from "next/link";

import { nav } from "../_content";
import { Logo } from "@/components/design/logo";

export function SiteFooter() {
  return (
    <footer
      data-header-tone="dark"
      className="surface-dark mx-4 my-4 overflow-hidden rounded-section px-6 pt-14 pb-10 sm:mx-6 sm:px-12"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="flex flex-col justify-between gap-8 md:flex-row">
          <div className="flex max-w-sm flex-col gap-4">
            <Logo />
            <p className="text-sm leading-relaxed text-on-dark-muted">
              Klinikler için yapay zekâ destekli sesli asistan. Aramaları karşılar, randevuları
              yönetir, ekibinize zaman kazandırır.
            </p>
          </div>
          <ul className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm">
            {nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-on-dark-muted hover:text-on-dark">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/#iletisim" className="text-on-dark-muted hover:text-on-dark">
                İletişim
              </Link>
            </li>
          </ul>
        </div>
        <div className="flex flex-col justify-between gap-2 border-t border-glass-border pt-6 text-xs text-on-dark-muted sm:flex-row">
          <p>© {new Date().getFullYear()} Recall</p>
          <p>Uygulama ve veritabanı Avrupa&apos;da barındırılır · KVKK odaklı altyapı</p>
        </div>
      </div>
    </footer>
  );
}
