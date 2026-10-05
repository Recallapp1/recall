"use server";

import { revalidatePath } from "next/cache";

import { firstIssue, memberPreferencesSchema, type SettingsResult } from "@/lib/contracts/settings";
import { safeError } from "@/lib/safe-error";
import { requireClinic } from "@/server/auth/session";
import { db } from "@/server/db";
import { DomainError } from "@/server/domain/errors";
import { saveMemberPreferences } from "@/server/domain/preferences";

/** Personal preferences: every member may change their own. */
export async function savePreferences(input: unknown): Promise<SettingsResult> {
  const { member, clinic } = await requireClinic();
  const parsed = memberPreferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  try {
    await saveMemberPreferences(db(), {
      memberId: member.id,
      clinicId: clinic.id,
      preferences: parsed.data,
    });
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, message: error.userMessage };
    console.error(JSON.stringify({ msg: "panel.preferences.failed", error: safeError(error) }));
    return { ok: false, message: "Tercihler şu anda kaydedilemedi." };
  }
  revalidatePath("/panel", "layout");
  return { ok: true, message: "Tercihleriniz kaydedildi." };
}
