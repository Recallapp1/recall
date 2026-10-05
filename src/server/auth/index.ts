import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, organization } from "better-auth/plugins";
import { and, asc, eq } from "drizzle-orm";

import { env } from "@/lib/env";
import { ac, ROLE_LABELS, roles, type RoleName } from "@/lib/permissions";

import { db } from "../db";
import {
  accounts,
  clinics,
  invitations,
  members,
  organizationRoles,
  organizations,
  sessions,
  users,
  verifications,
} from "../db/schema";
import { recordAudit } from "../domain/audit";
import { invitationEmail, passwordEmail } from "../notifications/email-templates";
import { PLATFORM_ADMIN, platformAc, platformRoles } from "./platform";
import { sendEmail } from "../notifications/email";

export const SESSION_DAYS = 7;
export const INVITATION_DAYS = 7;
/** Long enough for a new account's "set your password" email to be opened the next day. */
export const PASSWORD_LINK_HOURS = 24;

/** Origin used for links in emails and as Better Auth's base URL. */
export function panelOrigin(): string {
  const config = env();
  return new URL(config.BETTER_AUTH_URL ?? config.APP_URL).origin;
}

function createAuth() {
  const config = env();
  const origin = panelOrigin();

  return betterAuth({
    appName: "Recall",
    baseURL: origin,
    // Development falls back to a fixed secret; env() requires a real one in production.
    secret: config.BETTER_AUTH_SECRET ?? "recall-development-secret-do-not-use-in-production",
    trustedOrigins: [...new Set([origin, new URL(config.APP_URL).origin])],
    database: drizzleAdapter(db(), {
      provider: "pg",
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
        organization: organizations,
        member: members,
        invitation: invitations,
        organizationRole: organizationRoles,
      },
    }),
    advanced: { database: { generateId: "uuid" } },
    session: {
      expiresIn: SESSION_DAYS * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
    },
    emailAndPassword: {
      enabled: true,
      // Accounts only come from invitations or the Recall team (ADR-009).
      disableSignUp: true,
      minPasswordLength: 10,
      resetPasswordTokenExpiresIn: PASSWORD_LINK_HOURS * 60 * 60,
      revokeSessionsOnPasswordReset: true,
      // The emailed link proves the mailbox, so a set password also verifies the address.
      async onPasswordReset({ user }) {
        await db().update(users).set({ emailVerified: true }).where(eq(users.id, user.id));
      },
      async sendResetPassword({ user, token }) {
        const [credential] = await db()
          .select({ id: accounts.id })
          .from(accounts)
          .where(and(eq(accounts.userId, user.id), eq(accounts.providerId, "credential")))
          .limit(1);
        await sendEmail(
          passwordEmail({
            to: user.email,
            url: `${origin}/sifre-belirle?token=${encodeURIComponent(token)}`,
            kind: credential ? "reset" : "setup",
            expiresInHours: PASSWORD_LINK_HOURS,
          }),
        );
      },
    },
    databaseHooks: {
      session: {
        create: {
          // Open the panel in the user's first clinic; the clinic switcher changes it.
          async before(session) {
            const [membership] = await db()
              .select({ organizationId: members.organizationId })
              .from(members)
              .where(eq(members.userId, session.userId))
              .orderBy(asc(members.createdAt))
              .limit(1);
            return {
              data: { ...session, activeOrganizationId: membership?.organizationId ?? null },
            };
          },
          async after(session) {
            const organizationId = (session as { activeOrganizationId?: string | null })
              .activeOrganizationId;
            const [clinic] = organizationId
              ? await db()
                  .select({ id: clinics.id })
                  .from(clinics)
                  .where(eq(clinics.organizationId, organizationId))
              : [];
            await recordAudit(db(), {
              clinicId: clinic?.id ?? null,
              actorUserId: session.userId,
              action: "auth.sign_in",
            });
          },
        },
      },
    },
    plugins: [
      organization({
        ac,
        roles,
        creatorRole: "owner",
        // Clinics are opened by the Recall team, never from the panel.
        allowUserToCreateOrganization: false,
        invitationExpiresIn: INVITATION_DAYS * 24 * 60 * 60,
        cancelPendingInvitationsOnReInvite: true,
        dynamicAccessControl: { enabled: true, maximumRolesPerOrganization: 20 },
        schema: {
          member: {
            additionalFields: {
              practitionerId: { type: "string", required: false, input: false },
            },
          },
        },
        async sendInvitationEmail({ id, email, role, organization: org, inviter }) {
          const [clinic] = await db()
            .select({ name: clinics.name })
            .from(clinics)
            .where(eq(clinics.organizationId, org.id))
            .limit(1);
          await sendEmail(
            invitationEmail({
              to: email,
              clinicName: clinic?.name ?? org.name,
              inviterName: inviter.user.name,
              roleLabel: ROLE_LABELS[role as RoleName] ?? role,
              url: `${origin}/davet/${id}`,
              expiresInDays: INVITATION_DAYS,
            }),
          );
        },
      }),
      admin({
        ac: platformAc,
        roles: platformRoles,
        adminRoles: [PLATFORM_ADMIN],
        defaultRole: "user",
        bannedUserMessage: "Hesabınız askıya alındı. Recall ekibiyle iletişime geçin.",
      }),
      // Must stay last: lets server actions set the session cookie.
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { recallAuth?: Auth };

/** Lazily created so `next build` does not need runtime secrets or a database. */
export function auth(): Auth {
  globalForAuth.recallAuth ??= createAuth();
  return globalForAuth.recallAuth;
}
