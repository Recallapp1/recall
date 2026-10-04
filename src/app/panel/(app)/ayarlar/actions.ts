"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import {
  assistantSettingsSchema,
  bookingRulesSchema,
  clinicProfileSchema,
  firstIssue,
  practitionerSchema,
  serviceSchema,
  weeklyHoursSchema,
  type SettingsResult,
} from "@/lib/contracts/settings";
import type { Permissions } from "@/lib/permissions";
import { safeError } from "@/lib/safe-error";
import { requirePermission, type PanelContext } from "@/server/auth/session";
import { db } from "@/server/db";
import { recordAudit } from "@/server/domain/audit";
import { DomainError } from "@/server/domain/errors";
import {
  replaceClinicHours,
  savePractitioner,
  saveService,
  updateAssistantSettings,
  updateBookingRules,
  updateClinicProfile,
} from "@/server/domain/settings";
import { scheduleAssistantSync, syncAssistantNow } from "@/server/voice/sync";

/**
 * Shared shape of every settings save: permission → shared Zod contract →
 * domain write → audit → assistant sync after the response (F5.3).
 */
async function saveSetting<Schema extends z.ZodType>(options: {
  permission: Permissions;
  schema: Schema;
  input: unknown;
  section: string;
  write: (context: PanelContext, data: z.output<Schema>) => Promise<string | void>;
  success: string;
  syncAssistant?: boolean;
}): Promise<SettingsResult> {
  const context = await requirePermission(options.permission);
  const parsed = options.schema.safeParse(options.input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };

  try {
    const targetId = await options.write(context, parsed.data);
    await recordAudit(db(), {
      clinicId: context.clinic.id,
      actorUserId: context.session.user.id,
      action: "settings.updated",
      targetType: options.section,
      targetId: targetId ?? undefined,
    });
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, message: error.userMessage };
    console.error(
      JSON.stringify({
        msg: "panel.settings.failed",
        section: options.section,
        error: safeError(error),
      }),
    );
    return { ok: false, message: "Ayarlar şu anda kaydedilemedi. Lütfen tekrar deneyin." };
  }

  if (options.syncAssistant !== false) scheduleAssistantSync(context.clinic.id);
  revalidatePath("/panel", "layout");
  return { ok: true, message: options.success };
}

export async function saveClinicProfile(input: unknown) {
  return saveSetting({
    permission: { clinicSettings: ["update"] },
    schema: clinicProfileSchema,
    input,
    section: "clinic",
    write: ({ clinic }, data) => updateClinicProfile(db(), clinic.id, data),
    success: "Klinik bilgileri kaydedildi.",
  });
}

export async function saveClinicHours(input: unknown) {
  return saveSetting({
    permission: { clinicSettings: ["update"] },
    schema: weeklyHoursSchema,
    input,
    section: "clinic_hours",
    write: ({ clinic }, data) => replaceClinicHours(db(), clinic.id, data),
    success: "Çalışma saatleri kaydedildi.",
  });
}

export async function savePractitionerSettings(input: unknown) {
  return saveSetting({
    permission: { clinicSettings: ["update"] },
    schema: practitionerSchema,
    input,
    section: "practitioner",
    write: ({ clinic }, data) => savePractitioner(db(), clinic.id, data),
    success: "Hekim kaydedildi.",
  });
}

export async function saveServiceSettings(input: unknown) {
  return saveSetting({
    permission: { clinicSettings: ["update"] },
    schema: serviceSchema,
    input,
    section: "service",
    write: ({ clinic }, data) => saveService(db(), clinic.id, data),
    success: "Hizmet kaydedildi.",
  });
}

export async function saveAssistantSettings(input: unknown) {
  return saveSetting({
    permission: { assistantSettings: ["update"] },
    schema: assistantSettingsSchema,
    input,
    section: "assistant",
    write: ({ clinic }, data) => updateAssistantSettings(db(), clinic.id, data),
    success: "Asistan ayarları kaydedildi. Asistan birkaç saniye içinde güncellenir.",
  });
}

export async function saveBookingRules(input: unknown) {
  return saveSetting({
    permission: { clinicSettings: ["update"] },
    schema: bookingRulesSchema,
    input,
    section: "booking",
    write: ({ clinic }, data) => updateBookingRules(db(), clinic.id, data),
    success: "Randevu kuralları kaydedildi.",
  });
}

/** "Şimdi güncelle" on the assistant page: synchronous, reports the result. */
export async function syncAssistant(): Promise<SettingsResult> {
  const { clinic } = await requirePermission({ assistantSettings: ["update"] });
  try {
    const result = await syncAssistantNow(clinic.id);
    revalidatePath("/panel/ayarlar/asistan");
    if (!result) return { ok: false, message: "Bu klinik için henüz bir sesli asistan kurulmadı." };
    if (result.status === "error") {
      return { ok: false, message: "Asistan güncellenemedi. Recall ekibi bilgilendirildi." };
    }
    return {
      ok: true,
      message: result.status === "unchanged" ? "Asistan zaten güncel." : "Asistan güncellendi.",
    };
  } catch (error) {
    console.error(JSON.stringify({ msg: "voice.sync.failed", error: safeError(error) }));
    return { ok: false, message: "Asistan güncellenemedi. Recall ekibi bilgilendirildi." };
  }
}
