import { describe, expect, it } from "vitest";

import { customRoleSchema } from "./team";

describe("customRoleSchema", () => {
  it("lowercases Turkish-aware and adds read to any other action", () => {
    const parsed = customRoleSchema.parse({
      existing: false,
      name: "  İdari Asistan ",
      permission: { appointments: ["create"], calls: [], audit: ["read"] },
    });
    expect(parsed.name).toBe("idari asistan");
    expect(parsed.permission).toEqual({
      appointments: ["read", "create"],
      audit: ["read"],
    });
  });

  it("rejects team, billing and organization permissions", () => {
    for (const resource of ["member", "invitation", "billing", "organization", "ac"]) {
      expect(
        customRoleSchema.safeParse({
          existing: false,
          name: "rol",
          permission: { [resource]: ["create"] },
        }).success,
      ).toBe(false);
    }
  });

  it("drops unknown actions and needs at least one permission", () => {
    expect(
      customRoleSchema.safeParse({
        existing: false,
        name: "boş",
        permission: { appointments: ["delete_all"] },
      }).success,
    ).toBe(false);
  });

  it("does not shadow built-in roles or allow role-list separators", () => {
    for (const name of ["admin", "Owner", "hekim", "a,b"]) {
      expect(
        customRoleSchema.safeParse({ existing: false, name, permission: { audit: ["read"] } })
          .success,
      ).toBe(false);
    }
  });
});
