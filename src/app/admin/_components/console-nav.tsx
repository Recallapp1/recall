"use client";

import { Building2, Inbox, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/admin", label: "Klinikler", icon: Building2 },
  { href: "/admin/klinikler/yeni", label: "Yeni klinik", icon: Plus },
  { href: "/admin/demo-talepleri", label: "Demo talepleri", icon: Inbox },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") {
    return (
      pathname === "/admin" ||
      (pathname.startsWith("/admin/klinikler/") && !pathname.endsWith("/yeni"))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ConsoleNav({ orientation }: { orientation: "vertical" | "horizontal" }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Konsol menüsü">
      <ul className={cn("flex gap-1", orientation === "vertical" ? "flex-col" : "overflow-x-auto")}>
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm whitespace-nowrap transition-colors duration-300",
                  orientation === "vertical"
                    ? active
                      ? "bg-glass-strong font-medium text-on-dark"
                      : "text-on-dark-muted hover:bg-glass hover:text-on-dark"
                    : active
                      ? "bg-paper font-medium text-heading ring-1 ring-hairline"
                      : "text-body hover:bg-paper hover:text-heading",
                )}
              >
                <Icon
                  aria-hidden
                  className={cn("size-4", active && orientation === "vertical" && "text-accent")}
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
