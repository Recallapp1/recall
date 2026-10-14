import "server-only";

import { and, eq } from "drizzle-orm";

import { auth } from "../auth";
import { normalizeEmail } from "../auth/accounts";
import { consoleClinicMembershipBlocked, PLATFORM_ADMIN } from "../auth/platform";
import { db } from "../db";
import { accounts, clinics, members, users } from "../db/schema";
import { recordAudit } from "../domain/audit";
import { DomainError } from "../domain/errors";

/**
 * Makes someone a Recall console admin (CLI only: the first admin cannot be
 * created from the console). New users get a "set your password" email.
 */
export async function ensurePlatformAdmin(input: {
  email: string;
  name: string;
}): Promise<{ userCreated: boolean; passwordEmailSent: boolean }> {
  const email = normalizeEmail(input.email);
  const result = await db().transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.email, email));
    let userId = existing?.id;
    if (userId) {
      // A clinic member becoming a console user joins those clinics as one (FA-07).
      const memberships =
        existing!.role === PLATFORM_ADMIN
          ? []
          : await tx
              .select({ clinicId: clinics.id, role: members.role })
              .from(members)
              .innerJoin(clinics, eq(clinics.organizationId, members.organizationId))
              .where(eq(members.userId, userId));
      if (memberships.length > 0 && consoleClinicMembershipBlocked()) {
        throw new DomainError(
          "CONSOLE_USER_IN_CLINIC",
          "Bu kişi bir kliniğin ekibinde; Recall konsol kullanıcısı yapılamaz.",
        );
      }
      await tx.update(users).set({ role: PLATFORM_ADMIN }).where(eq(users.id, userId));
      for (const membership of memberships) {
        await recordAudit(tx, {
          clinicId: membership.clinicId,
          actorUserId: null,
          action: "platform.console_user_joined_clinic",
          targetType: "user",
          targetId: userId,
          metadata: { role: membership.role, via: "console_role_granted" },
        });
      }
    } else {
      const [created] = await tx
        .insert(users)
        .values({ name: input.name.trim(), email, role: PLATFORM_ADMIN })
        .returning({ id: users.id });
      userId = created!.id;
    }
    const [credential] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")));
    return { userCreated: !existing, needsPassword: !credential };
  });
  if (result.needsPassword) {
    await auth().api.requestPasswordReset({ body: { email } });
  }
  return { userCreated: result.userCreated, passwordEmailSent: result.needsPassword };
}
