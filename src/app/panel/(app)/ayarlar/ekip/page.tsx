import type { Metadata } from "next";

import { ASSIGNABLE_ROLES, isBuiltInRole, memberRoles } from "@/lib/permissions";
import { can, requirePermission } from "@/server/auth/session";
import { listPendingInvitations, listTeam } from "@/server/auth/team";
import { db } from "@/server/db";
import { loadClinicDirectory, practitionerDisplayName } from "@/server/domain/clinics";

import { TeamManager } from "./team-manager";

export const metadata: Metadata = { title: "Ekip" };

export default async function TeamPage() {
  const context = await requirePermission({ invitation: ["create"] });
  const organizationId = context.clinic.organizationId!;
  const [team, invitations, directory, canUpdate, canRemove, canCancel] = await Promise.all([
    listTeam(db(), organizationId),
    listPendingInvitations(db(), organizationId),
    loadClinicDirectory(db(), context.clinic.id),
    can({ member: ["update"] }),
    can({ member: ["delete"] }),
    can({ invitation: ["cancel"] }),
  ]);
  const assignable = [
    ...new Set(
      memberRoles(context.member.role)
        .filter(isBuiltInRole)
        .flatMap((role) => ASSIGNABLE_ROLES[role]),
    ),
  ];

  return (
    <TeamManager
      currentUserId={context.session.user.id}
      members={team}
      invitations={invitations}
      practitioners={directory.practitioners.map((p) => ({
        id: p.id,
        name: practitionerDisplayName(p),
      }))}
      assignableRoles={assignable}
      permissions={{ update: canUpdate, remove: canRemove, cancel: canCancel }}
    />
  );
}
