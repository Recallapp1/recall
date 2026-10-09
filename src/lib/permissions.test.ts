import { describe, expect, it } from "vitest";

import {
  ASSIGNABLE_ROLES,
  builtInRolesAllow,
  type Permissions,
  type RoleName,
} from "./permissions";

/** The F3.2 matrix: which built-in role may do what. */
const MATRIX: Array<[Permissions, Record<RoleName, boolean>]> = [
  [{ appointments: ["read"] }, { owner: true, admin: true, staff: true, practitioner: true }],
  [{ appointments: ["create"] }, { owner: true, admin: true, staff: true, practitioner: false }],
  [{ appointments: ["cancel"] }, { owner: true, admin: true, staff: true, practitioner: false }],
  [{ patients: ["anonymize"] }, { owner: true, admin: true, staff: false, practitioner: false }],
  [{ calls: ["read"] }, { owner: true, admin: true, staff: true, practitioner: false }],
  [
    { calls: ["listen_recording"] },
    { owner: true, admin: true, staff: false, practitioner: false },
  ],
  [{ callbacks: ["update"] }, { owner: true, admin: true, staff: true, practitioner: false }],
  [{ clinicSettings: ["update"] }, { owner: true, admin: true, staff: false, practitioner: false }],
  [
    { assistantSettings: ["update"] },
    { owner: true, admin: true, staff: false, practitioner: false },
  ],
  [{ billing: ["manage"] }, { owner: true, admin: false, staff: false, practitioner: false }],
  [{ invitation: ["create"] }, { owner: true, admin: true, staff: false, practitioner: false }],
  [{ member: ["delete"] }, { owner: true, admin: true, staff: false, practitioner: false }],
  [{ organization: ["delete"] }, { owner: true, admin: false, staff: false, practitioner: false }],
  [{ ac: ["create"] }, { owner: true, admin: true, staff: false, practitioner: false }],
  [{ audit: ["read"] }, { owner: true, admin: true, staff: false, practitioner: false }],
];

describe("built-in role matrix", () => {
  for (const [permissions, expected] of MATRIX) {
    for (const [role, allowed] of Object.entries(expected)) {
      it(`${role} ${allowed ? "can" : "cannot"} ${JSON.stringify(permissions)}`, () => {
        expect(builtInRolesAllow(role, permissions)).toBe(allowed);
      });
    }
  }

  it("combines several roles", () => {
    expect(builtInRolesAllow("practitioner,staff", { appointments: ["create"] })).toBe(true);
  });

  it("defers custom roles to the server", () => {
    expect(builtInRolesAllow("on-buro", { appointments: ["read"] })).toBeUndefined();
  });

  it("lets only owners hand out the owner role", () => {
    expect(ASSIGNABLE_ROLES.owner).toContain("owner");
    expect(ASSIGNABLE_ROLES.admin).not.toContain("owner");
    expect(ASSIGNABLE_ROLES.staff).toEqual([]);
  });
});

describe("Takip permissions (TAKIP.md §G)", () => {
  it("staff manage plans but not rules; practitioners have no access in V1", () => {
    expect(builtInRolesAllow("staff", { followUps: ["read", "manage"] })).toBe(true);
    // Rules and Takip settings live under clinic settings.
    expect(builtInRolesAllow("staff", { clinicSettings: ["update"] })).toBe(false);
    expect(builtInRolesAllow("admin", { followUps: ["manage"], clinicSettings: ["update"] })).toBe(
      true,
    );
    expect(builtInRolesAllow("practitioner", { followUps: ["read"] })).toBe(false);
  });
});

/**
 * Every clinic resource and action, for every built-in role (audit A10). A
 * change to the role definitions must change this table on purpose.
 */
const EXHAUSTIVE: Record<string, Record<string, RoleName[]>> = {
  appointments: {
    read: ["owner", "admin", "staff", "practitioner"],
    create: ["owner", "admin", "staff"],
    update: ["owner", "admin", "staff", "practitioner"],
    cancel: ["owner", "admin", "staff"],
  },
  patients: {
    read: ["owner", "admin", "staff", "practitioner"],
    update: ["owner", "admin", "staff"],
    anonymize: ["owner", "admin"],
    export: ["owner", "admin"],
  },
  calls: { read: ["owner", "admin", "staff"], listen_recording: ["owner", "admin"] },
  callbacks: { read: ["owner", "admin", "staff"], update: ["owner", "admin", "staff"] },
  followUps: { read: ["owner", "admin", "staff"], manage: ["owner", "admin", "staff"] },
  clinicSettings: {
    read: ["owner", "admin", "staff", "practitioner"],
    update: ["owner", "admin"],
  },
  assistantSettings: { read: ["owner", "admin", "staff"], update: ["owner", "admin"] },
  billing: { read: ["owner", "admin"], manage: ["owner"] },
  audit: { read: ["owner", "admin"] },
};

describe("exhaustive clinic permission matrix", () => {
  const roles: RoleName[] = ["owner", "admin", "staff", "practitioner"];
  for (const [resource, actions] of Object.entries(EXHAUSTIVE)) {
    for (const [action, allowed] of Object.entries(actions)) {
      for (const role of roles) {
        const expected = allowed.includes(role);
        it(`${role} ${expected ? "can" : "cannot"} ${resource}.${action}`, () => {
          expect(builtInRolesAllow(role, { [resource]: [action] } as Permissions)).toBe(expected);
        });
      }
    }
  }
});
