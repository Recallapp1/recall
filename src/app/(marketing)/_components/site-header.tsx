import { Menu } from "lucide-react";
import Link from "next/link";

import { nav } from "../_content";
import { Logo } from "./logo";

/**
 * Sticky floating navigation: stays visible while scrolling. Navy glass so it
 * reads on both the dark hero and the light sections below it.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 px-4 pt-3 sm:px-6">
      <nav
        aria-label="Ana menü"
        className="mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full border border-glass-border bg-surface-dark/85 py-2 pr-2 pl-4 shadow-lg shadow-ink/10 backdrop-blur-[20px]"
      >
        <Link href="/" aria-label="Recall ana sayfa">
          <Logo />
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {nav.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                className="rounded-full px-4 py-2 text-sm text-on-dark-soft transition-colors duration-300 hover:bg-glass-strong hover:text-on-dark"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <a
            href="#iletisim"
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium whitespace-nowrap text-on-dark transition-colors duration-300 hover:bg-primary-hover"
          >
            Demo talep edin
          </a>

          {/* No-JS mobile menu. */}
          <details className="group relative lg:hidden">
            <summary
              aria-label="Menüyü aç"
              className="flex size-10 cursor-pointer list-none items-center justify-center rounded-full text-on-dark hover:bg-glass-strong [&::-webkit-details-marker]:hidden"
            >
              <Menu aria-hidden className="size-5" />
            </summary>
            <ul className="absolute top-12 right-0 flex w-56 flex-col gap-1 rounded-card border border-glass-border bg-surface-dark p-2 shadow-xl">
              {nav.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="block rounded-card-sm px-4 py-3 text-sm text-on-dark-soft hover:bg-glass-strong hover:text-on-dark"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </nav>
    </header>
  );
}
