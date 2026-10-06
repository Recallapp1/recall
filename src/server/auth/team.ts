import "server-only";

import { and, asc, eq, gt } from "drizzle-orm";

import { memberRoles } from "@/lib/permissions";

import type { Executor } from "../db";
import { invitations, members, organizationRoles, practitioners, users } from "../db/schema";
import { DomainError } from "../domain/errors";

/** The clinic's team for the "Ekip" settings page (F3.3). */
export async function listTeam(exec: Executor, organizationId: string) {
  return exec
    .select({
      memberId: members.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      role: members.role,
      practitionerId: members.practitionerId,
      createdAt: members.createdAt,
    })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(eq(members.organizationId, organizationId))
    .orderBy(asc(users.name));
}

export async function listPendingInvitations(exec: Executor, organizationId: string) {
  return exec
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
      createdAt: invitations.createdAt,
    })
    .from(invitations)
    .where(
      and(
        eq(invitations.organizationId, organizationId),
        eq(invitations.status, "pending"),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .orderBy(asc(invitations.createdAt));
}

export async function findMember(exec: Executor, organizationId: string, memberId: string) {
  const [member] = await exec
    .select({ id: members.id, userId: members.userId, role: members.role })
    .from(members)
    .where(and(eq(members.organizationId, organizationId), eq(members.id, memberId)));
  return member ?? null;
}

/** "Son owner çıkarılamaz": a clinic always keeps at least one owner. */
export async function assertNotLastOwner(
  exec: Executor,
  organizationId: string,
  memberId: string,
): Promise<void> {
  const team = await exec
    .select({ id: members.id, role: members.role })
    .from(members)
    .where(eq(members.organizationId, organizationId));
  const owners = team.filter((m) => memberRoles(m.role).includes("owner"));
  if (owners.length === 1 && owners[0]!.id === memberId) {
    throw new DomainError(
      "LAST_OWNER",
      "Kliniğin tek sahibi bu kişi. Önce başka birini klinik sahibi yapın.",
    );
  }
}

/** Links a member to the practitioner whose calendar they see (practitioner role). */
export async function setMemberPractitioner(
  exec: Executor,
  input: {
    organizationId: string;
    clinicId: string;
    memberId: string;
    practitionerId: string | null;
  },
): Promise<void> {
  if (input.practitionerId) {
    const [practitioner] = await exec
      .select({ id: practitioners.id })
      .from(practitioners)
      .where(
        and(eq(practitioners.clinicId, input.clinicId), eq(practitioners.id, input.practitionerId)),
      );
    if (!practitioner) throw new DomainError("INVALID_PRACTITIONER", "Hekim bulunamadı.");
  }
  const updated = await exec
    .update(members)
    .set({ practitionerId: input.practitionerId })
    .where(and(eq(members.organizationId, input.organizationId), eq(members.id, input.memberId)))
    .returning({ id: members.id });
  if (updated.length === 0) throw new DomainError("NOT_FOUND", "Ekip üyesi bulunamadı.");
}

export interface CustomRole {
  name: string;
  permission: Record<string, string[]>;
}

/** The clinic's own roles (Better Auth dynamic access control), by name. */
export async function listCustomRoles(
  exec: Executor,
  organizationId: string,
): Promise<CustomRole[]> {
  const rows = await exec
    .select({ name: organizationRoles.role, permission: organizationRoles.permission })
    .from(organizationRoles)
    .where(eq(organizationRoles.organizationId, organizationId))
    .orderBy(asc(organizationRoles.role));
  return rows.map((row) => ({
    name: row.name,
    permission: JSON.parse(row.permission) as Record<string, string[]>,
  }));
}
