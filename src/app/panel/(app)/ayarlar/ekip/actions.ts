"use server";

import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import type { SettingsResult } from "@/lib/contracts/settings";
import { ASSIGNABLE_ROLES, isBuiltInRole, memberRoles, type RoleName } from "@/lib/permissions";
import { safeError } from "@/lib/safe-error";
import { auth } from "@/server/auth";
import { requirePermission, type PanelContext } from "@/server/auth/session";
import { assertNotLastOwner, findMember, setMemberPractitioner } from "@/server/auth/team";
import { db } from "@/server/db";
import { recordAudit, type AuditInput } from "@/server/domain/audit";
import { DomainError } from "@/server/domain/errors";

/** Roles the current member may hand out (only owners create owners). */
function assignableBy(role: string): Set<RoleName> {
  return new Set(
    memberRoles(role)
      .filter(isBuiltInRole)
      .flatMap((name) => ASSIGNABLE_ROLES[name]),
  );
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
};

function failure(event: string, error: unknown): SettingsResult {
  if (error instanceof DomainError) return { ok: false, message: error.userMessage };
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
  role: z.enum(["owner", "admin", "staff", "practitioner"]),
});

export async function inviteMember(input: unknown): Promise<SettingsResult> {
  const context = await requirePermission({ invitation: ["create"] });
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  if (!assignableBy(context.member.role).has(parsed.data.role)) {
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
  role: z.enum(["owner", "admin", "staff", "practitioner"]),
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
    const assignable = assignableBy(context.member.role);
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
    if (
      memberRoles(member.role).includes("owner") &&
      !assignableBy(context.member.role).has("owner")
    ) {
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
