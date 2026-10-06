import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

/**
 * Clinic permission model (IMPLEMENTATION-PLAN F3.2): resource × action.
 * Shared by the server (enforcement) and the panel (hiding actions the user
 * cannot take). `organization`, `member`, `invitation` and `ac` come from
 * Better Auth and cover team management and custom roles.
 */
export const statement = {
  ...defaultStatements,
  appointments: ["read", "create", "update", "cancel"],
  // export: KVKK access request (m.11), a copy of everything held on a patient.
  patients: ["read", "update", "anonymize", "export"],
  calls: ["read", "listen_recording"],
  callbacks: ["read", "update"],
  // Takip (TAKIP.md §G); rules and settings stay under clinicSettings.update.
  followUps: ["read", "manage"],
  clinicSettings: ["read", "update"],
  assistantSettings: ["read", "update"],
  billing: ["read", "manage"],
  audit: ["read"],
} as const;

export const ac = createAccessControl(statement);

export type Resource = keyof typeof statement;
export type Permissions = { [R in Resource]?: (typeof statement)[R][number][] };

/** Everything in the clinic, including billing and deleting the clinic's team. */
export const owner = ac.newRole({
  ...ownerAc.statements,
  appointments: ["read", "create", "update", "cancel"],
  patients: ["read", "update", "anonymize", "export"],
  calls: ["read", "listen_recording"],
  callbacks: ["read", "update"],
  followUps: ["read", "manage"],
  clinicSettings: ["read", "update"],
  assistantSettings: ["read", "update"],
  billing: ["read", "manage"],
  audit: ["read"],
});

/** Clinic manager: like the owner, but cannot manage billing. */
export const admin = ac.newRole({
  ...adminAc.statements,
  appointments: ["read", "create", "update", "cancel"],
  patients: ["read", "update", "anonymize", "export"],
  calls: ["read", "listen_recording"],
  callbacks: ["read", "update"],
  followUps: ["read", "manage"],
  clinicSettings: ["read", "update"],
  assistantSettings: ["read", "update"],
  billing: ["read"],
  audit: ["read"],
});

/** Front desk: runs the calendar and the callback list. */
export const staff = ac.newRole({
  ...memberAc.statements,
  appointments: ["read", "create", "update", "cancel"],
  patients: ["read", "update"],
  calls: ["read"],
  callbacks: ["read", "update"],
  followUps: ["read", "manage"],
  clinicSettings: ["read"],
  assistantSettings: ["read"],
});

/** Practitioner: their own calendar (scoped by members.practitioner_id) and patients. */
export const practitioner = ac.newRole({
  ...memberAc.statements,
  appointments: ["read", "update"],
  patients: ["read"],
  clinicSettings: ["read"],
});

export const roles = { owner, admin, staff, practitioner };
export type RoleName = keyof typeof roles;

export const ROLE_LABELS: Record<RoleName, string> = {
  owner: "Klinik sahibi",
  admin: "Yönetici",
  staff: "Sekreter",
  practitioner: "Hekim",
};

/** Roles an inviter may hand out; only an owner can create another owner. */
export const ASSIGNABLE_ROLES: Record<RoleName, RoleName[]> = {
  owner: ["owner", "admin", "staff", "practitioner"],
  admin: ["admin", "staff", "practitioner"],
  staff: [],
  practitioner: [],
};

export function isBuiltInRole(role: string): role is RoleName {
  return Object.hasOwn(roles, role);
}

/** Better Auth stores several roles as "admin,staff". */
export function memberRoles(role: string): string[] {
  return role
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Whether built-in roles grant every requested action. Returns `undefined`
 * when the member also has a custom role, which only the server can resolve.
 */
export function builtInRolesAllow(role: string, permissions: Permissions): boolean | undefined {
  const names = memberRoles(role);
  if (names.some((name) => !isBuiltInRole(name))) return undefined;
  return names.some(
    (name) => roles[name as RoleName].authorize(permissions as Record<string, string[]>).success,
  );
}

/**
 * What a clinic may put into a custom role (F5): clinic data only. Team
 * management, billing and the organization stay with the built-in owner and
 * admin roles, so a custom role can never hand out access by itself.
 */
export const CUSTOM_ROLE_PERMISSIONS = {
  appointments: {
    label: "Randevular",
    actions: { read: "Görüntüle", create: "Oluştur", update: "Düzenle", cancel: "İptal et" },
  },
  patients: {
    label: "Hastalar",
    actions: {
      read: "Görüntüle",
      update: "Not düzenle",
      export: "Verileri indir",
      anonymize: "Anonimleştir",
    },
  },
  calls: { label: "Aramalar", actions: { read: "Görüntüle", listen_recording: "Kayıt dinle" } },
  callbacks: { label: "Geri aranacaklar", actions: { read: "Görüntüle", update: "Güncelle" } },
  followUps: { label: "Takip", actions: { read: "Görüntüle", manage: "Yönet" } },
  clinicSettings: { label: "Klinik ayarları", actions: { read: "Görüntüle", update: "Düzenle" } },
  assistantSettings: {
    label: "Asistan ayarları",
    actions: { read: "Görüntüle", update: "Düzenle" },
  },
  audit: { label: "Denetim kaydı", actions: { read: "Görüntüle" } },
} as const satisfies {
  [R in Resource]?: {
    label: string;
    actions: Partial<Record<(typeof statement)[R][number], string>>;
  };
};

export type CustomRoleResource = keyof typeof CUSTOM_ROLE_PERMISSIONS;

/** "diş asistanı" → "Diş asistanı"; built-in roles use their Turkish label. */
export function roleLabel(role: string): string {
  if (isBuiltInRole(role)) return ROLE_LABELS[role];
  return role.charAt(0).toLocaleUpperCase("tr-TR") + role.slice(1);
}
