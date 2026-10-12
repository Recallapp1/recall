import "server-only";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";

import { builtInRolesAllow, memberRoles, type Permissions } from "@/lib/permissions";

import { db } from "../db";
import { clinics, members } from "../db/schema";
import { findClinicById, type ClinicContext } from "../domain/clinics";
import { scopeFor, type PanelScope } from "../domain/panel";
import { auth } from ".";
import { PLATFORM_ADMIN } from "./platform";
import { ENROLMENT_PATH, enrolmentRequired } from "./two-factor";

/** The signed-in user's session for this request, or null. Cached per request. */
export const getSession = cache(async () => auth().api.getSession({ headers: await headers() }));

export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

export interface PanelContext extends ClinicContext {
  session: Session;
  member: { id: string; role: string; practitionerId: string | null };
}

/** Every panel page and server action starts here or with requireClinic(). */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/giris");
  return session;
}

/**
 * The clinic the user is working in (the session's active organization),
 * resolved on the server and checked against membership. Tenant scoping for
 * every panel query comes from here, never from the client.
 */
export const requireClinic = cache(async (): Promise<PanelContext> => {
  const session = await requireSession();
  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) redirect("/panel/klinik-sec");

  const [row] = await db()
    .select({
      clinicId: clinics.id,
      memberId: members.id,
      role: members.role,
      practitionerId: members.practitionerId,
    })
    .from(members)
    .innerJoin(clinics, eq(clinics.organizationId, members.organizationId))
    .where(and(eq(members.organizationId, organizationId), eq(members.userId, session.user.id)));
  if (!row) redirect("/panel/klinik-sec");

  const context = await findClinicById(db(), row.clinicId);
  if (!context) redirect("/panel/klinik-sec");

  // PANEL_TWO_FACTOR required-*: nothing in the panel before enrolment.
  const platformRole = (session.user as { role?: string | null }).role ?? null;
  if (await enrolmentRequired(session.user.id, { memberRole: row.role, platformRole })) {
    redirect(ENROLMENT_PATH);
  }

  return {
    ...context,
    session,
    member: { id: row.memberId, role: row.role, practitionerId: row.practitionerId },
  };
});

/** Whether the current member may perform the actions (built-in or custom roles). */
export async function can(permissions: Permissions): Promise<boolean> {
  const { member } = await requireClinic();
  const builtIn = builtInRolesAllow(member.role, permissions);
  if (builtIn !== undefined) return builtIn;

  const result = await auth().api.hasPermission({
    headers: await headers(),
    body: { permissions: permissions as Record<string, string[]> },
  });
  return result.success;
}

/** Server-side gate: renders the 403 page when the member lacks a permission. */
export async function requirePermission(permissions: Permissions): Promise<PanelContext> {
  const context = await requireClinic();
  if (!(await can(permissions))) forbidden();
  return context;
}

/** Matches no practitioner: a practitioner member not yet linked sees an empty calendar. */
const NO_PRACTITIONER = "00000000-0000-0000-0000-000000000000";

/**
 * Query scope for the panel. Members whose only role is "practitioner" see
 * their own calendar (members.practitioner_id); everyone else the whole clinic.
 */
export async function requirePanelScope(permissions: Permissions): Promise<{
  context: PanelContext;
  scope: PanelScope;
}> {
  const context = await requirePermission(permissions);
  const roles = memberRoles(context.member.role);
  const practitionerOnly = roles.length > 0 && roles.every((role) => role === "practitioner");
  return {
    context,
    scope: scopeFor(
      context,
      practitionerOnly ? (context.member.practitionerId ?? NO_PRACTITIONER) : null,
    ),
  };
}

/** Recall console pages and actions start here (F6). */
export async function requirePlatformAdmin(): Promise<Session> {
  const session = await requireSession();
  if ((session.user as { role?: string | null }).role !== PLATFORM_ADMIN) forbidden();
  if (await enrolmentRequired(session.user.id, { platformRole: PLATFORM_ADMIN })) {
    redirect(ENROLMENT_PATH);
  }
  return session;
}
