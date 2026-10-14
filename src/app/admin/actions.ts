"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { env } from "@/lib/env";

import { fieldErrors, type FormState } from "@/lib/contracts/form-state";
import {
  clinicLimitsInputSchema,
  createClinicSchema,
  DEMO_REQUEST_STATUSES,
  phoneNumberSchema,
  type CreateClinicField,
} from "@/lib/contracts/platform";
import type { SettingsResult } from "@/lib/contracts/settings";
import { safeError } from "@/lib/safe-error";
import { addClinicMember } from "@/server/auth/accounts";
import { requirePlatformAdmin } from "@/server/auth/session";
import { mayResetTwoFactor, resetTwoFactor } from "@/server/auth/two-factor";
import { db } from "@/server/db";
import { clinics, members } from "@/server/db/schema";
import { recordAudit, withAudit, type AuditInput } from "@/server/domain/audit";
import { DomainError } from "@/server/domain/errors";
import { setClinicFeature, setClinicLimits } from "@/server/domain/settings";
import {
  addPhoneNumber,
  createClinic,
  removePhoneNumber,
  setClinicStatus,
} from "@/server/platform/clinics";
import { setDemoRequestStatus } from "@/server/platform/demo-requests";
import { ensureAssistant, scheduleAssistantSync } from "@/server/voice/sync";

const TRY_AGAIN = "İşlem şu anda yapılamadı. Lütfen tekrar deneyin.";

function failure(event: string, error: unknown): SettingsResult {
  if (error instanceof DomainError) return { ok: false, message: error.userMessage };
  console.error(JSON.stringify({ msg: event, error: safeError(error) }));
  return { ok: false, message: TRY_AGAIN };
}

async function audit(actorUserId: string, entry: Omit<AuditInput, "actorUserId">) {
  await recordAudit(db(), { actorUserId, ...entry });
}

export async function createClinicAction(
  _previous: FormState<CreateClinicField>,
  formData: FormData,
): Promise<FormState<CreateClinicField>> {
  const session = await requirePlatformAdmin();
  const parsed = createClinicSchema.safeParse({
    name: formData.get("name") ?? "",
    slug: formData.get("slug") ?? "",
    template: formData.get("template") ?? "",
    ownerName: formData.get("ownerName") ?? "",
    ownerEmail: formData.get("ownerEmail") ?? "",
    phoneNumber: formData.get("phoneNumber") ?? "",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Lütfen işaretli alanları kontrol edin.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  let clinicId: string;
  try {
    ({ clinicId } = await createClinic(db(), parsed.data));
    await audit(session.user.id, {
      clinicId,
      action: "platform.clinic_created",
      targetType: "clinic",
      targetId: clinicId,
      metadata: { template: parsed.data.template },
    });
    await addClinicMember({
      clinicId,
      email: parsed.data.ownerEmail,
      name: parsed.data.ownerName,
      role: "owner",
    });
  } catch (error) {
    return { status: "error", message: failure("platform.clinic_create.failed", error).message };
  }
  revalidatePath("/admin");
  redirect(`/admin/klinikler/${clinicId}?olusturuldu=1`);
}

export async function setClinicStatusAction(
  clinicId: string,
  status: "active" | "paused",
): Promise<SettingsResult> {
  const session = await requirePlatformAdmin();
  if (!z.uuid().safeParse(clinicId).success) return { ok: false, message: "Klinik bulunamadı." };
  try {
    await withAudit(
      db(),
      {
        actorUserId: session.user.id,
        clinicId,
        action: "platform.clinic_status_changed",
        targetType: "clinic",
        targetId: clinicId,
        metadata: { status },
      },
      (tx) => setClinicStatus(tx, clinicId, status),
    );
  } catch (error) {
    return failure("platform.clinic_status.failed", error);
  }
  revalidatePath("/admin", "layout");
  return {
    ok: true,
    message:
      status === "paused"
        ? "Klinik duraklatıldı. Asistan arayanlara randevu vermeyip geri arama notu alır."
        : "Klinik yeniden açıldı.",
  };
}

/** Per-clinic modules (Takip). Only the Recall team switches them. */
export async function setClinicFeatureAction(
  clinicId: string,
  feature: "followUp",
  enabled: boolean,
): Promise<SettingsResult> {
  const session = await requirePlatformAdmin();
  if (!z.uuid().safeParse(clinicId).success) return { ok: false, message: "Klinik bulunamadı." };
  if (feature !== "followUp") return { ok: false, message: "Modül bulunamadı." };
  try {
    await withAudit(
      db(),
      {
        actorUserId: session.user.id,
        clinicId,
        action: "platform.feature_changed",
        targetType: "clinic",
        targetId: clinicId,
        metadata: { feature, enabled },
      },
      (tx) => setClinicFeature(tx, clinicId, feature, enabled),
    );
  } catch (error) {
    return failure("platform.feature.failed", error);
  }
  revalidatePath("/admin", "layout");
  return {
    ok: true,
    message: enabled
      ? "Takip modülü açıldı. Klinik, kurallarını Ayarlar → Takip kurallarından tanımlar."
      : "Takip modülü kapatıldı. Veriler korunur; hatırlatmalar durur.",
  };
}

/**
 * A clinic's abuse and cost limits (CONSOLE_LIMITS_EDIT, full audit FA-09).
 * Recall team only; the change and its audit record commit together. The
 * maximum call length is part of the assistant, so it is synced afterwards.
 */
export async function setClinicLimitsAction(input: unknown): Promise<SettingsResult> {
  const session = await requirePlatformAdmin();
  if (env().CONSOLE_LIMITS_EDIT !== true) return { ok: false, message: "Bu özellik kapalı." };
  const parsed = clinicLimitsInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  const { clinicId, limits } = parsed.data;
  try {
    await db().transaction(async (tx) => {
      const fields = await setClinicLimits(tx, clinicId, limits);
      await recordAudit(tx, {
        actorUserId: session.user.id,
        clinicId,
        action: "platform.limits_changed",
        targetType: "clinic",
        targetId: clinicId,
        metadata: { fields },
      });
    });
  } catch (error) {
    return failure("platform.limits.failed", error);
  }
  scheduleAssistantSync(clinicId);
  revalidatePath(`/admin/klinikler/${clinicId}`);
  return { ok: true, message: "Sınırlar kaydedildi." };
}

export async function addPhoneNumberAction(input: unknown): Promise<SettingsResult> {
  const session = await requirePlatformAdmin();
  const parsed = phoneNumberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  try {
    await withAudit(
      db(),
      {
        actorUserId: session.user.id,
        clinicId: parsed.data.clinicId,
        action: "platform.phone_number_added",
        targetType: "phone_number",
      },
      (tx) => addPhoneNumber(tx, parsed.data),
    );
  } catch (error) {
    return failure("platform.phone_add.failed", error);
  }
  revalidatePath(`/admin/klinikler/${parsed.data.clinicId}`);
  return { ok: true, message: "Numara bağlandı." };
}

export async function removePhoneNumberAction(
  clinicId: string,
  phoneNumberId: string,
): Promise<SettingsResult> {
  const session = await requirePlatformAdmin();
  if (!z.uuid().safeParse(clinicId).success || !z.uuid().safeParse(phoneNumberId).success) {
    return { ok: false, message: "Numara bulunamadı." };
  }
  try {
    await withAudit(
      db(),
      {
        actorUserId: session.user.id,
        clinicId,
        action: "platform.phone_number_removed",
        targetType: "phone_number",
        targetId: phoneNumberId,
      },
      (tx) => removePhoneNumber(tx, { clinicId, phoneNumberId }),
    );
  } catch (error) {
    return failure("platform.phone_remove.failed", error);
  }
  revalidatePath(`/admin/klinikler/${clinicId}`);
  return { ok: true, message: "Numara kaldırıldı." };
}

export async function syncAssistantAction(
  clinicId: string,
  force: boolean,
): Promise<SettingsResult> {
  const session = await requirePlatformAdmin();
  if (!z.uuid().safeParse(clinicId).success) return { ok: false, message: "Klinik bulunamadı." };
  try {
    const result = await ensureAssistant(clinicId, force);
    revalidatePath(`/admin/klinikler/${clinicId}`);
    if (result.status === "error") {
      return { ok: false, message: `Asistan senkronize edilemedi: ${result.error}` };
    }
    await audit(session.user.id, {
      clinicId,
      action: "platform.assistant_synced",
      targetType: "clinic",
      targetId: clinicId,
      metadata: { result: result.status, force },
    });
    const labels = {
      created: "Asistan oluşturuldu.",
      updated: "Asistan güncellendi.",
      unchanged: "Asistan zaten güncel.",
    };
    return { ok: true, message: labels[result.status] };
  } catch (error) {
    return failure("platform.assistant_sync.failed", error);
  }
}

const memberSchema = z.object({
  clinicId: z.uuid(),
  name: z.string().trim().min(2, "Adı yazın.").max(100),
  email: z.string().trim().toLowerCase().pipe(z.email("Geçerli bir e-posta adresi yazın.")),
  role: z.enum(["owner", "admin"]),
});

export async function addClinicMemberAction(input: unknown): Promise<SettingsResult> {
  const session = await requirePlatformAdmin();
  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  try {
    const result = await addClinicMember(parsed.data);
    await audit(session.user.id, {
      clinicId: parsed.data.clinicId,
      action: "platform.member_added",
      targetType: "user",
      targetId: result.userId,
      metadata: { role: parsed.data.role },
    });
    revalidatePath(`/admin/klinikler/${parsed.data.clinicId}`);
    if (!result.memberCreated) return { ok: true, message: "Bu kişi zaten ekipte." };
    return {
      ok: true,
      message: result.passwordEmailSent
        ? "Eklendi; parola belirleme e-postası gönderildi."
        : "Eklendi; kişi mevcut hesabıyla giriş yapabilir.",
    };
  } catch (error) {
    return failure("platform.member_add.failed", error);
  }
}

export async function setDemoRequestStatusAction(
  id: string,
  status: string,
): Promise<SettingsResult> {
  await requirePlatformAdmin();
  const parsed = z
    .object({ id: z.uuid(), status: z.enum(DEMO_REQUEST_STATUSES) })
    .safeParse({ id, status });
  if (!parsed.success) return { ok: false, message: TRY_AGAIN };
  try {
    await setDemoRequestStatus(db(), { ...parsed.data, now: new Date() });
  } catch (error) {
    return failure("platform.demo_status.failed", error);
  }
  revalidatePath("/admin/demo-talepleri");
  return { ok: true, message: "Durum güncellendi." };
}

const resetSchema = z.object({
  clinicId: z.uuid(),
  userId: z.uuid(),
  calledBack: z.literal(true, { error: "Önce kliniği kayıtlı numarasından geri arayın." }),
});

/**
 * Resets someone's two-step sign-in (lost phone and lost recovery codes).
 * Owner's decision 2026-10-12: only the Recall owner (TWO_FACTOR_RESET_EMAILS),
 * only after calling the clinic back on its registered number; audited.
 */
export async function resetTwoFactorAction(input: unknown): Promise<SettingsResult> {
  const session = await requirePlatformAdmin();
  if (!mayResetTwoFactor(session.user.email, env().TWO_FACTOR_RESET_EMAILS)) {
    return { ok: false, message: "Sıfırlama yalnızca Recall sahibine açık." };
  }
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  const [membership] = await db()
    .select({ id: members.id })
    .from(members)
    .innerJoin(clinics, eq(clinics.organizationId, members.organizationId))
    .where(and(eq(clinics.id, parsed.data.clinicId), eq(members.userId, parsed.data.userId)));
  if (!membership) return { ok: false, message: "Bu kişi bu kliniğin ekibinde değil." };
  try {
    await withAudit(
      db(),
      {
        clinicId: parsed.data.clinicId,
        actorUserId: session.user.id,
        action: "auth.two_factor_reset_by_recall",
        targetType: "user",
        targetId: parsed.data.userId,
        metadata: { calledBackOnRegisteredNumber: true },
      },
      (tx) => resetTwoFactor(tx, parsed.data.userId),
    );
    revalidatePath(`/admin/klinikler/${parsed.data.clinicId}`);
    return { ok: true, message: "Sıfırlandı; kişi bir sonraki girişte yeniden kurar." };
  } catch (error) {
    return failure("platform.two_factor_reset.failed", error);
  }
}
