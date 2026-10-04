import "server-only";

import { and, eq, gt } from "drizzle-orm";

import type { RoleName } from "@/lib/permissions";

import type { Executor } from "../db";
import { db } from "../db";
import { accounts, clinics, invitations, members, organizations, users } from "../db/schema";
import { recordAudit } from "../domain/audit";
import { DomainError } from "../domain/errors";
import { auth } from ".";

/*
 * Account provisioning. Public sign-up is disabled (ADR-009): accounts are
 * created by the Recall team (addClinicMember) or by accepting an invitation.
 */

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Creates the clinic's Better Auth organization on first use (1:1, same slug). */
export async function ensureClinicOrganization(clinicId: string): Promise<string> {
  return db().transaction(async (tx) => {
    const [clinic] = await tx
      .select({ name: clinics.name, slug: clinics.slug, organizationId: clinics.organizationId })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .for("update");
    if (!clinic) throw new DomainError("CLINIC_NOT_FOUND", "Klinik bulunamadı.");
    if (clinic.organizationId) return clinic.organizationId;

    const [organization] = await tx
      .insert(organizations)
      .values({ name: clinic.name, slug: clinic.slug })
      .returning({ id: organizations.id });
    await tx
      .update(clinics)
      .set({ organizationId: organization!.id })
      .where(eq(clinics.id, clinicId));
    return organization!.id;
  });
}

async function findUserByEmail(exec: Executor, email: string) {
  const [user] = await exec
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.email, normalizeEmail(email)));
  return user;
}

async function hasPassword(exec: Executor, userId: string): Promise<boolean> {
  const [credential] = await exec
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")));
  return Boolean(credential);
}

export interface AddMemberResult {
  userId: string;
  userCreated: boolean;
  memberCreated: boolean;
  passwordEmailSent: boolean;
}

/**
 * Recall team / CLI: adds a person to a clinic. New users get a
 * "set your password" email (Better Auth's reset flow creates the password).
 */
export async function addClinicMember(input: {
  clinicId: string;
  email: string;
  name: string;
  role: RoleName;
}): Promise<AddMemberResult> {
  const email = normalizeEmail(input.email);
  const organizationId = await ensureClinicOrganization(input.clinicId);

  const result = await db().transaction(async (tx) => {
    let user = await findUserByEmail(tx, email);
    const userCreated = !user;
    if (!user) {
      [user] = await tx
        .insert(users)
        .values({ name: input.name.trim(), email })
        .returning({ id: users.id, name: users.name });
    }
    const inserted = await tx
      .insert(members)
      .values({ organizationId, userId: user!.id, role: input.role })
      .onConflictDoNothing()
      .returning({ id: members.id });
    if (inserted.length > 0) {
      await recordAudit(tx, {
        clinicId: input.clinicId,
        actorUserId: null,
        action: "team.member_added",
        targetType: "user",
        targetId: user!.id,
        metadata: { role: input.role, via: "recall_team" },
      });
    }
    return {
      userId: user!.id,
      userCreated,
      memberCreated: inserted.length > 0,
      needsPassword: !(await hasPassword(tx, user!.id)),
    };
  });

  if (result.needsPassword) {
    await auth().api.requestPasswordReset({ body: { email, redirectTo: "/giris" } });
  }
  return {
    userId: result.userId,
    userCreated: result.userCreated,
    memberCreated: result.memberCreated,
    passwordEmailSent: result.needsPassword,
  };
}

export interface InvitationView {
  id: string;
  email: string;
  role: string;
  clinicName: string;
  /** True when an account already exists for the address: sign in instead of creating one. */
  accountExists: boolean;
}

/** A pending, unexpired invitation, for the acceptance page. */
export async function findOpenInvitation(invitationId: string): Promise<InvitationView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(invitationId)) return null;
  const [row] = await db()
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      clinicName: clinics.name,
    })
    .from(invitations)
    .innerJoin(clinics, eq(clinics.organizationId, invitations.organizationId))
    .where(
      and(
        eq(invitations.id, invitationId),
        eq(invitations.status, "pending"),
        gt(invitations.expiresAt, new Date()),
      ),
    );
  if (!row) return null;
  const user = await findUserByEmail(db(), row.email);
  return { ...row, role: row.role ?? "staff", accountExists: Boolean(user) };
}

/**
 * Creates the account for a new invitee and accepts the invitation in one
 * transaction. The invitation link proves the email address, so it is marked
 * verified. Existing users accept through Better Auth after signing in.
 */
export async function acceptInvitationAsNewUser(input: {
  invitationId: string;
  name: string;
  password: string;
}): Promise<{ email: string }> {
  const context = await auth().$context;
  const hash = await context.password.hash(input.password);

  return db().transaction(async (tx) => {
    const [invitation] = await tx
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.id, input.invitationId),
          eq(invitations.status, "pending"),
          gt(invitations.expiresAt, new Date()),
        ),
      )
      .for("update");
    if (!invitation)
      throw new DomainError("INVITATION_INVALID", "Davet geçersiz veya süresi dolmuş.");

    const email = normalizeEmail(invitation.email);
    if (await findUserByEmail(tx, email)) {
      throw new DomainError(
        "ACCOUNT_EXISTS",
        "Bu e-posta ile bir hesap var. Giriş yapıp daveti kabul edin.",
      );
    }

    const [user] = await tx
      .insert(users)
      .values({ name: input.name.trim(), email, emailVerified: true })
      .returning({ id: users.id });
    await tx.insert(accounts).values({
      userId: user!.id,
      accountId: user!.id,
      providerId: "credential",
      password: hash,
    });
    await tx.insert(members).values({
      organizationId: invitation.organizationId,
      userId: user!.id,
      role: invitation.role ?? "staff",
    });
    await tx
      .update(invitations)
      .set({ status: "accepted" })
      .where(eq(invitations.id, invitation.id));
    const [clinic] = await tx
      .select({ id: clinics.id })
      .from(clinics)
      .where(eq(clinics.organizationId, invitation.organizationId));
    await recordAudit(tx, {
      clinicId: clinic?.id ?? null,
      actorUserId: user!.id,
      action: "team.invitation_accepted",
      targetType: "invitation",
      targetId: invitation.id,
      metadata: { role: invitation.role ?? "staff", newAccount: true },
    });
    return { email };
  });
}

export interface Membership {
  organizationId: string;
  clinicName: string;
  role: string;
}

/** Clinics the user belongs to, for the clinic switcher. */
export async function listMemberships(userId: string): Promise<Membership[]> {
  return db()
    .select({
      organizationId: members.organizationId,
      clinicName: clinics.name,
      role: members.role,
    })
    .from(members)
    .innerJoin(clinics, eq(clinics.organizationId, members.organizationId))
    .where(eq(members.userId, userId))
    .orderBy(clinics.name);
}
