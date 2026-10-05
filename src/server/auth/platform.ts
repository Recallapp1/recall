import "server-only";

import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

/**
 * Platform (Recall team) access, separate from clinic roles (F6). The admin
 * plugin's impersonation, deletion and password/email changes are granted to
 * nobody: patient data is reachable only through a clinic membership (F7).
 */
export const PLATFORM_ADMIN = "platform_admin";

export const platformAc = createAccessControl(defaultStatements);

export const platformRoles = {
  user: platformAc.newRole({ user: [], session: [] }),
  [PLATFORM_ADMIN]: platformAc.newRole({
    user: ["list", "get", "create", "set-role", "ban"],
    session: ["list", "revoke"],
  }),
};
