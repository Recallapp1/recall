import "server-only";

import { and, eq } from "drizzle-orm";

import type { MemberPreferencesInput } from "@/lib/contracts/settings";

import type { Executor } from "../db";
import { memberPreferences, practitioners } from "../db/schema";
import { DomainError } from "./errors";

export const DEFAULT_PREFERENCES: MemberPreferencesInput = {
  startPage: "bugun",
  calendarView: null,
  calendarPractitionerId: null,
};

export async function getMemberPreferences(
  exec: Executor,
  memberId: string,
): Promise<MemberPreferencesInput> {
  const [row] = await exec
    .select()
    .from(memberPreferences)
    .where(eq(memberPreferences.memberId, memberId));
  if (!row) return DEFAULT_PREFERENCES;
  return {
    startPage:
      (["bugun", "takvim", "randevular"] as const).find((p) => p === row.startPage) ?? "bugun",
    calendarView:
      row.calendarView === "gun" || row.calendarView === "hafta" ? row.calendarView : null,
    calendarPractitionerId: row.calendarPractitionerId,
  };
}

export async function saveMemberPreferences(
  exec: Executor,
  input: { memberId: string; clinicId: string; preferences: MemberPreferencesInput },
): Promise<void> {
  const { calendarPractitionerId } = input.preferences;
  if (calendarPractitionerId) {
    const [practitioner] = await exec
      .select({ id: practitioners.id })
      .from(practitioners)
      .where(
        and(
          eq(practitioners.clinicId, input.clinicId),
          eq(practitioners.id, calendarPractitionerId),
        ),
      );
    if (!practitioner) throw new DomainError("INVALID_PRACTITIONER", "Hekim bulunamadı.");
  }
  await exec
    .insert(memberPreferences)
    .values({ memberId: input.memberId, ...input.preferences })
    .onConflictDoUpdate({ target: memberPreferences.memberId, set: { ...input.preferences } });
}
