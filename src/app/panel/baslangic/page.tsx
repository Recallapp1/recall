import { redirect } from "next/navigation";

import { START_PAGES } from "@/lib/contracts/settings";
import { PLATFORM_ADMIN } from "@/server/auth/platform";
import { requireClinic, requireSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { getMemberPreferences } from "@/server/domain/preferences";

/** Landing route after sign-in: the member's start page, or the console for the Recall team. */
export default async function StartPage() {
  const session = await requireSession();
  const isPlatformAdmin = (session.user as { role?: string | null }).role === PLATFORM_ADMIN;
  if (isPlatformAdmin && !session.session.activeOrganizationId) redirect("/admin");

  const { member } = await requireClinic();
  const preferences = await getMemberPreferences(db(), member.id);
  redirect(START_PAGES[preferences.startPage].href);
}
