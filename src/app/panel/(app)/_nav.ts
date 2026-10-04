import {
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  PhoneCall,
  PhoneForwarded,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { PanelModule } from "@/lib/contracts/settings";
import type { Permissions } from "@/lib/permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** The menu item is shown only when the member has this permission. */
  permission: Permissions;
  /** Clinics can hide optional modules (settings.panel.hiddenModules). */
  module?: PanelModule;
  /** Shown in the mobile tab bar; the rest go under "Daha fazla". */
  primary?: boolean;
}

/** Panel modules (IMPLEMENTATION-PLAN F5.2). */
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/panel",
    label: "Bugün",
    icon: LayoutDashboard,
    permission: { appointments: ["read"] },
    primary: true,
  },
  {
    href: "/panel/takvim",
    label: "Takvim",
    icon: CalendarDays,
    permission: { appointments: ["read"] },
    primary: true,
  },
  {
    href: "/panel/randevular",
    label: "Randevular",
    icon: ClipboardList,
    permission: { appointments: ["read"] },
    primary: true,
  },
  {
    href: "/panel/aramalar",
    label: "Aramalar",
    icon: PhoneCall,
    permission: { calls: ["read"] },
    module: "calls",
    primary: true,
  },
  {
    href: "/panel/geri-arama",
    label: "Geri aranacaklar",
    icon: PhoneForwarded,
    permission: { callbacks: ["read"] },
    module: "callbacks",
  },
  { href: "/panel/hastalar", label: "Hastalar", icon: Users, permission: { patients: ["read"] } },
  {
    href: "/panel/ayarlar",
    label: "Ayarlar",
    icon: Settings,
    permission: { clinicSettings: ["read"] },
  },
];
