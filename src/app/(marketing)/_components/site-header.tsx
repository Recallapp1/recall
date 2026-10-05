import { Menu } from "lucide-react";
import Link from "next/link";

import { nav } from "../_content";
import { HeaderSurface } from "./header-surface";
import { Logo } from "@/components/design/logo";

/**
 * Sticky floating navigation: stays visible while scrolling. The translucent
 * surface adapts to the section beneath it (see HeaderSurface).
 */
export function SiteHeader() {
  return (
    <header className="sticky top-3 z-50 mt-8 px-8 sm:mt-11 sm:px-12">
      <HeaderSurface>
        <Link href="/" aria-label="Recall ana sayfa">
          <Logo className="transition-colors duration-300 group-data-[tone=light]/nav:text-heading" />
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {nav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="rounded-full px-3 py-2 text-sm whitespace-nowrap text-on-dark-soft transition-colors duration-300 group-data-[tone=light]/nav:text-body hover:bg-glass-strong hover:text-on-dark group-data-[tone=light]/nav:hover:bg-canvas group-data-[tone=light]/nav:hover:text-heading"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/#iletisim"
            className="rounded-full bg-primary px-4 py-2.5 text-sm font-medium whitespace-nowrap text-on-dark transition-colors duration-300 hover:bg-primary-hover sm:px-5"
          >
            Demo talep edin
          </Link>

          {/* No-JS mobile menu. */}
          <details className="group relative lg:hidden">
            <summary
              aria-label="Menüyü aç"
              className="flex size-10 cursor-pointer list-none items-center justify-center rounded-full text-on-dark transition-colors duration-300 group-data-[tone=light]/nav:text-heading hover:bg-glass-strong group-data-[tone=light]/nav:hover:bg-canvas [&::-webkit-details-marker]:hidden"
            >
              <Menu aria-hidden className="size-5" />
            </summary>
            <ul className="absolute top-12 right-0 flex w-56 flex-col gap-1 rounded-card border border-glass-border bg-surface-dark p-2 shadow-xl">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block rounded-card-sm px-4 py-3 text-sm text-on-dark-soft hover:bg-glass-strong hover:text-on-dark"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </HeaderSurface>
    </header>
  );
}
