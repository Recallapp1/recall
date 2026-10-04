"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

/** Settings sections: horizontal pills on mobile, a vertical list on desktop. */
export function SettingsNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Ayarlar" className="lg:w-56 lg:shrink-0">
      <ul className="-mx-1 flex [scrollbar-width:none] gap-1 overflow-x-auto px-1 pb-1 lg:sticky lg:top-6 lg:flex-col lg:overflow-visible">
        {items.map(({ href, label }) => {
          const active = href === "/panel/ayarlar" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-paper text-heading shadow-sm ring-1 shadow-ink/5 ring-hairline"
                    : "text-body hover:bg-paper hover:text-heading",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
