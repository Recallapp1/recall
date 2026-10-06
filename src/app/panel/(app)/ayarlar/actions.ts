"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  assistantSettingsSchema,
  assistantVoiceSchema,
  bookingRulesSchema,
  clinicProfileSchema,
  firstIssue,
  panelPreferencesSchema,
  practitionerSchema,
  serviceSchema,
  timeOffSchema,
  weeklyHoursSchema,
  type SettingsResult,
} from "@/lib/contracts/settings";
import type { Permissions } from "@/lib/permissions";
import { safeError } from "@/lib/safe-error";
import { requirePermission, type PanelContext } from "@/server/auth/session";
import { db } from "@/server/db";
import { recordAudit } from "@/server/domain/audit";
import { DomainError } from "@/server/domain/errors";
import { HOLIDAY_YEARS, turkishPublicHolidays } from "@/lib/holidays";
import {
  addPublicHolidays,
  addTimeOff,
  deleteTimeOff,
  replaceClinicHours,
  savePractitioner,
  saveService,
  updateAssistantSettings,
  updateAssistantVoice,
  updateBookingRules,
  updateClinicProfile,
  updatePanelPreferences,
} from "@/server/domain/settings";
import {
  createTestWebCall,
  listAssistantVoices,
  scheduleAssistantSync,
  syncAssistantNow,
  type TestWebCall,
  type TestWebCallResult,
} from "@/server/voice/sync";

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

export async function saveAssistantVoice(input: unknown) {
  return saveSetting({
    permission: { assistantSettings: ["update"] },
    schema: assistantVoiceSchema,
    input,
    section: "assistant_voice",
    write: async ({ clinic }, { voiceId }) => {
      // Only voices the shared TTS model can speak; anything else would break the sync.
      if (voiceId && !(await listAssistantVoices()).some((voice) => voice.id === voiceId)) {
        throw new DomainError("INVALID_VOICE", "Bu ses kullanılamıyor. Listeden bir ses seçin.");
      }
      await updateAssistantVoice(db(), clinic.id, voiceId);
    },
    success: "Ses kaydedildi. Asistan birkaç saniye içinde yeni sesle konuşur.",
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

export async function savePanelPreferences(input: unknown) {
  return saveSetting({
    permission: { clinicSettings: ["update"] },
    schema: panelPreferencesSchema,
    input,
    section: "panel",
    write: ({ clinic }, data) => updatePanelPreferences(db(), clinic.id, data),
    success: "Panel tercihleri kaydedildi.",
    syncAssistant: false,
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

const TEST_CALL_MESSAGES: Record<Exclude<TestWebCallResult, { ok: true }>["reason"], string> = {
  not_configured: "Sesli asistan bu ortamda yapılandırılmamış.",
  no_agent: "Bu klinik için henüz bir sesli asistan kurulmadı.",
  sync_failed:
    "Asistan güncellenemedi; bu yüzden arama başlatılmadı. Birkaç dakika sonra tekrar deneyin.",
  unreachable:
    "Asistan Recall sunucusuna ulaşamıyor; randevu oluşturamayacağı için arama başlatılmadı. Recall ekibine haber verin.",
};

/** Browser test call with the clinic's assistant; billed by the voice platform like a call. */
export async function startTestCall(): Promise<
  ({ ok: true } & TestWebCall) | { ok: false; message: string }
> {
  const { clinic, session } = await requirePermission({ assistantSettings: ["update"] });
  try {
    const result = await createTestWebCall(clinic.id);
    if (!result.ok) {
      console.error(JSON.stringify({ msg: "voice.test_call.refused", reason: result.reason }));
      return { ok: false, message: TEST_CALL_MESSAGES[result.reason] };
    }
    const { call } = result;
    await recordAudit(db(), {
      clinicId: clinic.id,
      actorUserId: session.user.id,
      action: "assistant.test_call",
      targetType: "call",
      targetId: call.callId,
    });
    return { ok: true, ...call };
  } catch (error) {
    console.error(JSON.stringify({ msg: "voice.test_call.failed", error: safeError(error) }));
    return { ok: false, message: "Test araması başlatılamadı. Lütfen tekrar deneyin." };
  }
}

// Closures are read live by the availability engine; the assistant needs no sync.

export async function addTimeOffEntry(input: unknown): Promise<SettingsResult> {
  let conflicts = 0;
  const result = await saveSetting({
    permission: { clinicSettings: ["update"] },
    schema: timeOffSchema,
    input,
    section: "time_off",
    write: async ({ clinic }, data) => {
      const created = await addTimeOff(db(), clinic, data);
      conflicts = created.conflictingAppointments;
      return created.id;
    },
    success: "Kapalı gün eklendi.",
    syncAssistant: false,
  });
  if (result.ok && conflicts > 0) {
    return {
      ok: true,
      message: `Kapalı gün eklendi. Bu aralıkta ${conflicts} randevu var; Randevular sayfasından hastalara haber verin.`,
    };
  }
  return result;
}

export async function removeTimeOffEntry(id: string): Promise<SettingsResult> {
  return saveSetting({
    permission: { clinicSettings: ["update"] },
    schema: z.uuid(),
    input: id,
    section: "time_off",
    write: async ({ clinic }, value) => {
      await deleteTimeOff(db(), clinic.id, value);
      return value;
    },
    success: "Kayıt silindi.",
    syncAssistant: false,
  });
}

export async function addPublicHolidayEntries(year: number): Promise<SettingsResult> {
  let added = 0;
  const result = await saveSetting({
    permission: { clinicSettings: ["update"] },
    schema: z
      .number()
      .int()
      .refine((value) => HOLIDAY_YEARS.includes(value), "Bu yıl için tatil listesi yok."),
    input: year,
    section: "time_off",
    write: async ({ clinic }, value) => {
      added = await addPublicHolidays(db(), clinic, turkishPublicHolidays(value));
    },
    success: "",
    syncAssistant: false,
  });
  if (!result.ok) return result;
  return {
    ok: true,
    message:
      added > 0
        ? `${year} resmî tatillerinden ${added} gün eklendi.`
        : "Bu yılın resmî tatilleri zaten ekli.",
  };
}
