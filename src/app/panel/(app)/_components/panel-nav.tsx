"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";

import { NAV_ITEMS, type NavItem } from "../_nav";

function isActive(pathname: string, href: string) {
  return href === "/panel"
    ? pathname === "/panel"
    : pathname === href || pathname.startsWith(`${href}/`);
}

function visibleItems(allowed: readonly string[]): NavItem[] {
  return NAV_ITEMS.filter((item) => allowed.includes(item.href));
}

/** Desktop sidebar links on the navy surface. */
export function SidebarNav({ allowed }: { allowed: readonly string[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Panel menüsü">
      <ul className="flex flex-col gap-1">
        {visibleItems(allowed).map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm transition-colors duration-300",
                  active
                    ? "bg-glass-strong font-medium text-on-dark"
                    : "text-on-dark-muted hover:bg-glass hover:text-on-dark",
                )}
              >
                <Icon aria-hidden className={cn("size-4", active && "text-accent")} />
                {label}
                {active && <span aria-hidden className="ml-auto size-1.5 rounded-full bg-accent" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Mobile bottom tab bar: primary modules plus a "more" sheet. */
export function MobileTabBar({ allowed }: { allowed: readonly string[] }) {
  const pathname = usePathname();
  const items = visibleItems(allowed);
  const primary = items.filter((item) => item.primary);
  const rest = items.filter((item) => !item.primary);

  const tab = (active: boolean) =>
    cn(
      "flex flex-1 flex-col items-center gap-1 rounded-card-sm py-2 text-[11px] font-medium transition-colors",
      active ? "text-primary" : "text-body hover:text-heading",
    );

  return (
    <nav
      aria-label="Panel menüsü"
      className="fixed inset-x-3 bottom-3 z-40 flex gap-1 rounded-card border border-hairline bg-paper/90 p-1.5 shadow-xl shadow-ink/10 backdrop-blur-[20px] lg:hidden"
    >
      {primary.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={tab(active)}
          >
            <Icon aria-hidden className="size-5" />
            {label}
          </Link>
        );
      })}
      {rest.length > 0 && (
        <Sheet>
          <SheetTrigger className={tab(rest.some((item) => isActive(pathname, item.href)))}>
            <MoreHorizontal aria-hidden className="size-5" />
            Daha fazla
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-bento pb-8">
            <SheetHeader>
              <SheetTitle>Menü</SheetTitle>
            </SheetHeader>
            <ul className="flex flex-col gap-1 px-4">
              {rest.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="flex items-center gap-3 rounded-card-sm px-4 py-3 text-heading hover:bg-canvas"
                  >
                    <Icon aria-hidden className="size-5 text-primary" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </SheetContent>
        </Sheet>
      )}
    </nav>
  );
}
