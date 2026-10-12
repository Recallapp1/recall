import type { Metadata } from "next";

import { ASSIGNABLE_ROLES, isBuiltInRole, memberRoles } from "@/lib/permissions";
import { can, requirePermission } from "@/server/auth/session";
import { listCustomRoles, listPendingInvitations, listTeam } from "@/server/auth/team";
import { twoFactorPolicy } from "@/server/auth/two-factor";
import { db } from "@/server/db";
import { loadClinicDirectory, practitionerDisplayName } from "@/server/domain/clinics";

import { RolesManager } from "./roles-manager";
import { TeamManager } from "./team-manager";

export const metadata: Metadata = { title: "Ekip" };

export default async function TeamPage() {
  const context = await requirePermission({ invitation: ["create"] });
  const organizationId = context.clinic.organizationId!;
  const [
    team,
    invitations,
    directory,
    customRoles,
    canUpdate,
    canRemove,
    canCancel,
    canCreateRole,
    canUpdateRole,
    canDeleteRole,
  ] = await Promise.all([
    listTeam(db(), organizationId),
    listPendingInvitations(db(), organizationId),
    loadClinicDirectory(db(), context.clinic.id),
    listCustomRoles(db(), organizationId),
    can({ member: ["update"] }),
    can({ member: ["delete"] }),
    can({ invitation: ["cancel"] }),
    can({ ac: ["create"] }),
    can({ ac: ["update"] }),
    can({ ac: ["delete"] }),
  ]);
  const builtIn = [
    ...new Set(
      memberRoles(context.member.role)
        .filter(isBuiltInRole)
        .flatMap((role) => ASSIGNABLE_ROLES[role]),
    ),
  ];
  // Same rule as the server: custom roles go with the right to assign staff.
  const assignable: string[] = builtIn.includes("staff")
    ? [...builtIn, ...customRoles.map((role) => role.name)]
    : builtIn;

  return (
    <>
      <TeamManager
        currentUserId={context.session.user.id}
        members={team}
        invitations={invitations}
        practitioners={directory.practitioners.map((p) => ({
          id: p.id,
          name: practitionerDisplayName(p),
        }))}
        assignableRoles={assignable}
        customRoles={customRoles}
        permissions={{ update: canUpdate, remove: canRemove, cancel: canCancel }}
        twoFactorOn={twoFactorPolicy() !== "off"}
      />
      {(canCreateRole || customRoles.length > 0) && (
        <RolesManager
          roles={customRoles.map((role) => ({
            ...role,
            memberCount: team.filter((m) => memberRoles(m.role).includes(role.name)).length,
          }))}
          permissions={{ create: canCreateRole, update: canUpdateRole, remove: canDeleteRole }}
        />
      )}
    </>
  );
}
