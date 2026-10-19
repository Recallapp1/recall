import "server-only";

import { and, eq } from "drizzle-orm";

import { memberRoles } from "@/lib/permissions";
import { safeError } from "@/lib/safe-error";

import { PLATFORM_ADMIN } from "../auth/platform";
import type { Executor } from "../db";
import { calls, clinics, members, users } from "../db/schema";
import { maskEmail, type EmailMessage } from "../notifications/email";
import { unbackedClaimNotice } from "../notifications/email-templates";

/**
 * UNBACKED_CLAIM_EMAIL: the assistant said it booked, cancelled or moved an
 * appointment and our records disagree. The panel flag alone waits until
 * someone opens the calls list; the caller may already be on the way, so the
 * people who run the clinic hear about it right away.
 */

/**
 * The clinic's owners and admins, and the Recall console users on its team
 * (any team role; owner's decision, 19 Oct: until a clinic has its own
 * admins, the console user who set it up is the one who must know). Only
 * team members: the e-mail links to the clinic's panel, which needs one.
 */
export async function claimAlertRecipients(exec: Executor, clinicId: string): Promise<string[]> {
  const rows = await exec
    .select({ email: users.email, role: members.role, platformRole: users.role })
    .from(members)
    .innerJoin(clinics, eq(clinics.organizationId, members.organizationId))
    .innerJoin(users, eq(users.id, members.userId))
    .where(and(eq(clinics.id, clinicId), eq(users.banned, false)));
  return rows
    .filter(
      (row) =>
        row.platformRole === PLATFORM_ADMIN ||
        memberRoles(row.role).some((role) => role === "owner" || role === "admin"),
    )
    .map((row) => row.email);
}

export async function alertUnbackedClaim(
  exec: Executor,
  input: {
    clinicId: string;
    callId: string;
    /** Panel origin for the link. */
    origin: string;
    send: (message: EmailMessage) => Promise<void>;
  },
): Promise<{ sent: number; failed: number }> {
  const [row] = await exec
    .select({
      clinicName: clinics.name,
      timezone: clinics.timezone,
      startedAt: calls.startedAt,
      createdAt: calls.createdAt,
    })
    .from(calls)
    .innerJoin(clinics, eq(clinics.id, calls.clinicId))
    .where(and(eq(calls.clinicId, input.clinicId), eq(calls.id, input.callId)));
  if (!row) return { sent: 0, failed: 0 };

  const calledAt = new Intl.DateTimeFormat("tr-TR", {
    timeZone: row.timezone,
    dateStyle: "long",
    timeStyle: "short",
  }).format(row.startedAt ?? row.createdAt);
  const callUrl = `${input.origin}/panel/aramalar/${input.callId}`;

  let sent = 0;
  let failed = 0;
  for (const to of await claimAlertRecipients(exec, input.clinicId)) {
    try {
      await input.send(unbackedClaimNotice({ to, clinicName: row.clinicName, calledAt, callUrl }));
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error(
        JSON.stringify({
          msg: "call.claim_alert_failed",
          clinicId: input.clinicId,
          to: maskEmail(to),
          error: safeError(error),
        }),
      );
    }
  }
  return { sent, failed };
}
