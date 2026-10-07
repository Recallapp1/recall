"use server";

import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import type { SettingsResult } from "@/lib/contracts/settings";
import { customRoleNameSchema, customRoleSchema } from "@/lib/contracts/team";
import { ASSIGNABLE_ROLES, isBuiltInRole, memberRoles } from "@/lib/permissions";
import { safeError } from "@/lib/safe-error";
import { auth } from "@/server/auth";
import { requirePermission, type PanelContext } from "@/server/auth/session";
import {
  assertNotLastOwner,
  findMember,
  listCustomRoles,
  setMemberPractitioner,
} from "@/server/auth/team";
import { db } from "@/server/db";
import { AuditWriteError, recordAudit, type AuditInput } from "@/server/domain/audit";
import { DomainError } from "@/server/domain/errors";

/**
 * Roles the current member may hand out: built-in ones by rank (only owners
 * create owners), and the clinic's custom roles for anyone who may assign
 * staff (custom roles cannot include team or billing rights).
 */
async function assignableBy(context: PanelContext): Promise<Set<string>> {
  const builtIn = new Set<string>(
    memberRoles(context.member.role)
      .filter(isBuiltInRole)
      .flatMap((name) => ASSIGNABLE_ROLES[name]),
  );
  if (builtIn.has("staff")) {
    for (const role of await listCustomRoles(db(), organizationId(context))) builtIn.add(role.name);
  }
  return builtIn;
}

function organizationId(context: PanelContext): string {
  return context.clinic.organizationId!;
}

async function audit(
  context: PanelContext,
  entry: Omit<AuditInput, "clinicId" | "actorUserId">,
): Promise<void> {
  await recordAudit(db(), {
    clinicId: context.clinic.id,
    actorUserId: context.session.user.id,
    ...entry,
  });
}

/** Better Auth error codes the team page can run into, in Turkish. */
const AUTH_ERRORS: Record<string, string> = {
  USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION: "Bu kişi zaten ekipte.",
  USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION: "Bu adrese zaten bekleyen bir davet var.",
  INVITATION_NOT_FOUND: "Davet bulunamadı veya süresi dolmuş.",
  MEMBER_NOT_FOUND: "Ekip üyesi bulunamadı.",
  YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER: "Kliniğin en az bir sahibi olmalı.",
  ROLE_NAME_IS_ALREADY_TAKEN: "Bu adda bir rol zaten var.",
  TOO_MANY_ROLES: "En fazla 20 özel rol oluşturabilirsiniz.",
  ROLE_IS_ASSIGNED_TO_MEMBERS: "Bu rol ekipte kullanılıyor. Önce o kişilerin rolünü değiştirin.",
  ROLE_NOT_FOUND: "Rol bulunamadı.",
  YOU_ARE_NOT_ALLOWED_TO_CREATE_A_ROLE: "Sahip olmadığınız bir yetkiyi role ekleyemezsiniz.",
  YOU_ARE_NOT_ALLOWED_TO_UPDATE_A_ROLE: "Sahip olmadığınız bir yetkiyi role ekleyemezsiniz.",
};

function failure(event: string, error: unknown): SettingsResult {
  if (error instanceof DomainError) return { ok: false, message: error.userMessage };
  // Better Auth applied the change; only its trace is missing (alarm raised).
  if (error instanceof AuditWriteError) {
    return {
      ok: false,
      message:
        "Değişiklik yapıldı ancak denetim kaydına yazılamadı. Recall ekibi bilgilendirildi; lütfen ekip listesini kontrol edin.",
    };
  }
  if (error instanceof APIError) {
    const code = (error.body as { code?: string } | undefined)?.code;
    if (code && AUTH_ERRORS[code]) return { ok: false, message: AUTH_ERRORS[code] };
    if (error.statusCode === 403) return { ok: false, message: "Bu işlem için yetkiniz yok." };
  }
  console.error(JSON.stringify({ msg: event, error: safeError(error) }));
  return { ok: false, message: "İşlem şu anda yapılamadı. Lütfen tekrar deneyin." };
}

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Geçerli bir e-posta adresi yazın.")),
  role: z.string().trim().min(1).max(40),
});

export async function inviteMember(input: unknown): Promise<SettingsResult> {
  const context = await requirePermission({ invitation: ["create"] });
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  if (!(await assignableBy(context)).has(parsed.data.role)) {
    return { ok: false, message: "Bu rolü atama yetkiniz yok." };
  }

  try {
    const invitation = await auth().api.createInvitation({
      body: {
        email: parsed.data.email,
        role: parsed.data.role,
        organizationId: organizationId(context),
        resend: true,
      },
      headers: await headers(),
    });
    await audit(context, {
      action: "team.invitation_created",
      targetType: "invitation",
      targetId: invitation?.id,
      metadata: { role: parsed.data.role },
    });
  } catch (error) {
    return failure("panel.team_invite.failed", error);
  }
  revalidatePath("/panel/ayarlar/ekip");
  return { ok: true, message: "Davet e-postası gönderildi." };
}

export async function cancelInvitation(invitationId: string): Promise<SettingsResult> {
  const context = await requirePermission({ invitation: ["cancel"] });
  if (!z.uuid().safeParse(invitationId).success) return { ok: false, message: "Davet bulunamadı." };
  try {
    await auth().api.cancelInvitation({ body: { invitationId }, headers: await headers() });
    await audit(context, {
      action: "team.invitation_cancelled",
      targetType: "invitation",
      targetId: invitationId,
    });
  } catch (error) {
    return failure("panel.team_invite_cancel.failed", error);
  }
  revalidatePath("/panel/ayarlar/ekip");
  return { ok: true, message: "Davet iptal edildi." };
}

const memberSchema = z.object({
  memberId: z.uuid(),
  role: z.string().trim().min(1).max(40),
  practitionerId: z.uuid().nullable(),
});

export async function updateMember(input: unknown): Promise<SettingsResult> {
  const context = await requirePermission({ member: ["update"] });
  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Bilgiler geçersiz." };
  const { memberId, role, practitionerId } = parsed.data;

  try {
    const member = await findMember(db(), organizationId(context), memberId);
    if (!member) throw new DomainError("NOT_FOUND", "Ekip üyesi bulunamadı.");
    const assignable = await assignableBy(context);
    // Changing an owner, or making someone owner, needs the owner role.
    if (
      !assignable.has(role) ||
      (memberRoles(member.role).includes("owner") && !assignable.has("owner"))
    ) {
      return { ok: false, message: "Bu rolü atama yetkiniz yok." };
    }

    if (member.role !== role) {
      if (role !== "owner") await assertNotLastOwner(db(), organizationId(context), memberId);
      await auth().api.updateMemberRole({
        body: { memberId, role, organizationId: organizationId(context) },
        headers: await headers(),
      });
      await audit(context, {
        action: "team.member_role_changed",
        targetType: "member",
        targetId: memberId,
        metadata: { from: member.role, to: role },
      });
    }
    await setMemberPractitioner(db(), {
      organizationId: organizationId(context),
      clinicId: context.clinic.id,
      memberId,
      practitionerId: role === "practitioner" ? practitionerId : null,
    });
  } catch (error) {
    return failure("panel.team_update.failed", error);
  }
  revalidatePath("/panel/ayarlar/ekip");
  return { ok: true, message: "Ekip üyesi güncellendi." };
}

export async function removeMember(memberId: string): Promise<SettingsResult> {
  const context = await requirePermission({ member: ["delete"] });
  if (!z.uuid().safeParse(memberId).success)
    return { ok: false, message: "Ekip üyesi bulunamadı." };

  try {
    const member = await findMember(db(), organizationId(context), memberId);
    if (!member) throw new DomainError("NOT_FOUND", "Ekip üyesi bulunamadı.");
    if (member.userId === context.session.user.id) {
      return { ok: false, message: "Kendinizi ekipten çıkaramazsınız." };
    }
    if (memberRoles(member.role).includes("owner") && !(await assignableBy(context)).has("owner")) {
      return {
        ok: false,
        message: "Klinik sahibini yalnızca başka bir klinik sahibi çıkarabilir.",
      };
    }
    await assertNotLastOwner(db(), organizationId(context), memberId);
    await auth().api.removeMember({
      body: { memberIdOrEmail: memberId, organizationId: organizationId(context) },
      headers: await headers(),
    });
    await audit(context, {
      action: "team.member_removed",
      targetType: "member",
      targetId: memberId,
      metadata: { role: member.role },
    });
  } catch (error) {
    return failure("panel.team_remove.failed", error);
  }
  revalidatePath("/panel/ayarlar/ekip");
  return { ok: true, message: "Ekip üyesi çıkarıldı." };
}

export async function saveCustomRole(input: unknown): Promise<SettingsResult> {
  const parsed = customRoleSchema.safeParse(input);
  const context = await requirePermission({
    ac: [parsed.success && parsed.data.existing ? "update" : "create"],
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  const { existing, name, permission } = parsed.data;

  try {
    if (existing) {
      await auth().api.updateOrgRole({
        body: { roleName: name, organizationId: organizationId(context), data: { permission } },
        headers: await headers(),
      });
    } else {
      await auth().api.createOrgRole({
        body: { role: name, permission, organizationId: organizationId(context) },
        headers: await headers(),
      });
    }
    await audit(context, {
      action: "team.role_saved",
      targetType: "role",
      metadata: {
        role: name,
        permissions: Object.entries(permission).flatMap(([resource, actions]) =>
          actions.map((action) => `${resource}:${action}`),
        ),
      },
    });
  } catch (error) {
    return failure("panel.team_role_save.failed", error);
  }
  revalidatePath("/panel/ayarlar/ekip");
  return { ok: true, message: existing ? "Rol güncellendi." : "Rol oluşturuldu." };
}

export async function deleteCustomRole(name: unknown): Promise<SettingsResult> {
  const context = await requirePermission({ ac: ["delete"] });
  const parsed = customRoleNameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, message: "Rol bulunamadı." };

  try {
    await auth().api.deleteOrgRole({
      body: { roleName: parsed.data, organizationId: organizationId(context) },
      headers: await headers(),
    });
    await audit(context, {
      action: "team.role_deleted",
      targetType: "role",
      metadata: { role: parsed.data },
    });
  } catch (error) {
    return failure("panel.team_role_delete.failed", error);
  }
  revalidatePath("/panel/ayarlar/ekip");
  return { ok: true, message: "Rol silindi." };
}
