import "server-only";

import { createAccessControl } from "better-auth/plugins/access";

import { env } from "@/lib/env";
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

/**
 * BLOCK_CONSOLE_CLINIC_MEMBERSHIP (owner's decision 2026-10-14, full audit
 * FA-07): optional hard block on console users joining a clinic. Off by
 * default; every such join is audited either way.
 */
export function consoleClinicMembershipBlocked(): boolean {
  try {
    return env().BLOCK_CONSOLE_CLINIC_MEMBERSHIP === true;
  } catch {
    // Without a valid environment (some unit tests) the default applies.
    return false;
  }
}
