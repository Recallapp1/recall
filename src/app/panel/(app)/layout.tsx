import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/design";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { listMemberships } from "@/server/auth/accounts";
import { can, requireClinic } from "@/server/auth/session";

import { NAV_ITEMS } from "./_nav";
import { ClinicSwitcher, UserMenu } from "./_components/account-menus";
import { MobileTabBar, SidebarNav } from "./_components/panel-nav";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Recall paneli" },
  robots: { index: false },
};

/**
 * Panel shell (DESIGN-SYSTEM.md §3): navy sidebar, light content area, mobile
 * tab bar. Menu items the member has no permission for are not rendered.
 */
export default async function PanelLayout({ children }: LayoutProps<"/panel">) {
  const { clinic, session, member, settings } = await requireClinic();
  const hidden = new Set<string>(settings.panel.hiddenModules);
  const [memberships, allowed] = await Promise.all([
    listMemberships(session.user.id),
    Promise.all(
      NAV_ITEMS.map(async (item) =>
        (!item.module || !hidden.has(item.module)) && (await can(item.permission))
          ? item.href
          : null,
      ),
    ),
  ]);
  const visible = allowed.filter((href): href is string => href !== null);
  const current = { organizationId: clinic.organizationId!, clinicName: clinic.name };

  return (
    <TooltipProvider>
      <div className="flex min-h-dvh gap-3 bg-canvas p-3">
        <aside
          data-header-tone="dark"
          className="surface-dark sticky top-3 hidden h-[calc(100dvh-1.5rem)] w-64 shrink-0 flex-col gap-6 overflow-hidden rounded-section p-4 lg:flex"
        >
          <Link href="/panel" aria-label="Panel ana sayfa" className="px-2 pt-2">
            <Logo />
          </Link>
          <ClinicSwitcher current={current} options={memberships} role={member.role} />
          <div className="flex-1 overflow-y-auto">
            <SidebarNav allowed={visible} />
          </div>
          <div className="border-t border-glass-border pt-4">
            <UserMenu name={session.user.name} email={session.user.email} tone="dark" />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 px-1 pb-3 lg:hidden">
            <Link href="/panel" aria-label="Panel ana sayfa">
              <Logo className="text-heading" />
            </Link>
            <span className="min-w-0 flex-1 truncate text-right text-sm font-medium text-heading">
              {clinic.name}
            </span>
            <UserMenu name={session.user.name} email={session.user.email} />
          </header>
          <main className="flex flex-1 flex-col gap-6 pb-28 lg:p-4 lg:pb-8">{children}</main>
        </div>
      </div>
      <MobileTabBar allowed={visible} />
      <Toaster />
    </TooltipProvider>
  );
}
