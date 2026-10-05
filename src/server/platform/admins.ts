import "server-only";

import { and, eq } from "drizzle-orm";

import { auth } from "../auth";
import { normalizeEmail } from "../auth/accounts";
import { PLATFORM_ADMIN } from "../auth/platform";
import { db } from "../db";
import { accounts, users } from "../db/schema";

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
    const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email));
    let userId = existing?.id;
    if (userId) {
      await tx.update(users).set({ role: PLATFORM_ADMIN }).where(eq(users.id, userId));
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
