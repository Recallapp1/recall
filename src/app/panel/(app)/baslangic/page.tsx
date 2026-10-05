import { redirect } from "next/navigation";

import { START_PAGES } from "@/lib/contracts/settings";
import { requireClinic } from "@/server/auth/session";
import { db } from "@/server/db";
import { getMemberPreferences } from "@/server/domain/preferences";

/** Landing route after sign-in: opens the member's chosen start page. */
export default async function StartPage() {
  const { member } = await requireClinic();
  const preferences = await getMemberPreferences(db(), member.id);
  redirect(START_PAGES[preferences.startPage].href);
}
