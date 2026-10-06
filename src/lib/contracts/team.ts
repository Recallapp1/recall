import { z } from "zod";

import { CUSTOM_ROLE_PERMISSIONS, isBuiltInRole, type CustomRoleResource } from "../permissions";

const RESERVED = new Set(["member", "sahip", "yönetici", "sekreter", "hekim"]);

export const customRoleNameSchema = z
  .string()
  .trim()
  .min(2, "Rol adı en az 2 karakter.")
  .max(40, "Rol adı en fazla 40 karakter.")
  .regex(/^[\p{L}\p{N} .\-]+$/u, "Rol adında yalnızca harf, rakam, boşluk, nokta ve tire olabilir.")
  // The auth library lowercases names; doing it Turkish-aware keeps "İ" intact.
  .transform((name) => name.toLocaleLowerCase("tr-TR"))
  .refine((name) => !isBuiltInRole(name) && !RESERVED.has(name), "Bu ad hazır bir rolün adı.");

export const customRoleSchema = z.object({
  /** Set when editing; names are fixed once created (members reference them). */
  existing: z.boolean(),
  name: customRoleNameSchema,
  permission: z.record(z.string(), z.array(z.string())).transform((input, ctx) => {
    const permission: Partial<Record<CustomRoleResource, string[]>> = {};
    for (const [resource, actions] of Object.entries(input)) {
      const allowed = CUSTOM_ROLE_PERMISSIONS[resource as CustomRoleResource]?.actions;
      if (!allowed) {
        ctx.addIssue({ code: "custom", message: "Geçersiz yetki." });
        return z.NEVER;
      }
      const chosen = [...new Set(actions)].filter((action) => action in allowed);
      if (chosen.length === 0) continue;
      // Any action on a resource needs seeing it first.
      if (!chosen.includes("read")) chosen.unshift("read");
      permission[resource as CustomRoleResource] = chosen;
    }
    if (Object.keys(permission).length === 0) {
      ctx.addIssue({ code: "custom", message: "En az bir yetki seçin." });
      return z.NEVER;
    }
    return permission;
  }),
});
export type CustomRoleInput = z.input<typeof customRoleSchema>;
