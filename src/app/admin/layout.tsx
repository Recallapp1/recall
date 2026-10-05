import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/design";
import { Toaster } from "@/components/ui/sonner";
import { requirePlatformAdmin } from "@/server/auth/session";

import { UserMenu } from "../panel/(app)/_components/account-menus";
import { ConsoleNav } from "./_components/console-nav";

export const metadata: Metadata = {
  title: { default: "Konsol", template: "%s · Recall konsolu" },
  robots: { index: false },
};

/** Recall team console (F6): same shell language as the clinic panel. */
export default async function ConsoleLayout({ children }: LayoutProps<"/admin">) {
  const session = await requirePlatformAdmin();
  return (
    <>
      <div className="flex min-h-dvh gap-3 bg-canvas p-3">
        <aside
          data-header-tone="dark"
          className="surface-dark sticky top-3 hidden h-[calc(100dvh-1.5rem)] w-64 shrink-0 flex-col gap-6 overflow-hidden rounded-section p-4 lg:flex"
        >
          <Link
            href="/admin"
            aria-label="Konsol ana sayfa"
            className="flex items-center gap-2 px-2 pt-2"
          >
            <Logo />
            <span className="rounded-full glass px-2.5 py-1 text-label text-accent">Konsol</span>
          </Link>
          <div className="flex-1 overflow-y-auto">
            <ConsoleNav orientation="vertical" />
          </div>
          <div className="border-t border-glass-border pt-4">
            <UserMenu name={session.user.name} email={session.user.email} tone="dark" />
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="flex flex-col gap-3 lg:hidden">
            <div className="flex items-center justify-between gap-3 px-1">
              <Link href="/admin" aria-label="Konsol ana sayfa" className="flex items-center gap-2">
                <Logo className="text-heading" />
                <span className="rounded-full bg-primary-soft px-2.5 py-1 text-label text-primary">
                  Konsol
                </span>
              </Link>
              <UserMenu name={session.user.name} email={session.user.email} />
            </div>
            <ConsoleNav orientation="horizontal" />
          </header>
          <main className="flex flex-1 flex-col gap-6 pb-10 lg:p-4">{children}</main>
        </div>
      </div>
      <Toaster />
    </>
  );
}
