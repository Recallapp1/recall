"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";

import {
  followUpRuleSchema,
  planActionSchema,
  startPlanSchema,
  type PlanAction,
} from "@/lib/contracts/follow-up";
import type { SettingsResult } from "@/lib/contracts/settings";
import { CLINIC_TEMPLATE_KEYS } from "@/lib/clinic-templates";
import type { Permissions } from "@/lib/permissions";
import { safeError } from "@/lib/safe-error";
import { requirePermission, type PanelContext } from "@/server/auth/session";
import { db } from "@/server/db";
import { recordAudit, type AuditAction } from "@/server/domain/audit";
import { updateFollowUpSettings } from "@/server/domain/settings";
import { DomainError } from "@/server/domain/errors";
import {
  addExampleRules,
  applyPlanAction,
  archiveRule,
  duplicateRule,
  saveRule,
  startPlan,
} from "@/server/domain/follow-ups";

/** Takip is a per-clinic module; without it the actions do not exist. */
async function followUpContext(permission: Permissions): Promise<PanelContext> {
  const context = await requirePermission(permission);
  if (!context.settings.features.followUp) notFound();
  return context;
}

function scopeOf(context: PanelContext) {
  return { clinicId: context.clinic.id, timeZone: context.clinic.timezone };
}

async function audit(
  context: PanelContext,
  action: AuditAction,
  targetType: string,
  targetId: string,
  metadata?: Record<string, string | number | boolean | null | string[]>,
) {
  await recordAudit(db(), {
    clinicId: context.clinic.id,
    actorUserId: context.session.user.id,
    action,
    targetType,
    targetId,
    metadata,
  });
}

function failure(event: string, error: unknown): SettingsResult {
  if (error instanceof DomainError) return { ok: false, message: error.userMessage };
  console.error(JSON.stringify({ msg: event, error: safeError(error) }));
  return { ok: false, message: "İşlem şu anda yapılamadı. Lütfen tekrar deneyin." };
}

function refresh() {
  revalidatePath("/panel", "layout");
}

// ─── Plans (followUps.manage) ────────────────────────────────────────────────

export async function startFollowUp(input: unknown): Promise<SettingsResult & { planId?: string }> {
  const context = await followUpContext({ followUps: ["manage"] });
  const parsed = startPlanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  try {
    const planId = await startPlan(
      db(),
      scopeOf(context),
      context.session.user.id,
      parsed.data,
      new Date(),
    );
    await audit(context, "follow_up.started", "follow_up", planId, {
      ruleId: parsed.data.ruleId,
      fromAppointment: parsed.data.appointmentId !== null,
      smsConsent: parsed.data.smsConsent,
    });
    refresh();
    return { ok: true, message: "Takip başlatıldı.", planId };
  } catch (error) {
    return failure("panel.follow_up_start.failed", error);
  }
}

const ACTION_AUDIT: Record<PlanAction["type"], (a: PlanAction) => AuditAction> = {
  pause: () => "follow_up.paused",
  resume: () => "follow_up.resumed",
  stop: () => "follow_up.stopped",
  set_due: () => "follow_up.due_changed",
  clear_due: () => "follow_up.due_changed",
  record_visit: () => "follow_up.visit_recorded",
  link: () => "follow_up.linked",
  unlink: () => "follow_up.unlinked",
  consent: (a) =>
    a.type === "consent" && a.granted
      ? "follow_up.consent_recorded"
      : "follow_up.consent_withdrawn",
};

const ACTION_DONE: Record<PlanAction["type"], string> = {
  pause: "Takip duraklatıldı.",
  resume: "Takip sürdürülüyor.",
  stop: "Takip bırakıldı.",
  set_due: "Sonraki tarih güncellendi.",
  clear_due: "Tarih yeniden hesaplanıyor.",
  record_visit: "Ziyaret kaydedildi.",
  link: "Randevu takibe bağlandı.",
  unlink: "Randevu takipten ayrıldı.",
  consent: "SMS onayı güncellendi.",
};

export async function followUpAction(input: unknown): Promise<SettingsResult> {
  const context = await followUpContext({ followUps: ["manage"] });
  const parsed = planActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Bilgiler geçersiz." };
  const action = parsed.data;
  try {
    await applyPlanAction(db(), scopeOf(context), context.session.user.id, action, new Date());
    // Ids and codes only: dates and free text stay out of the audit trail.
    await audit(context, ACTION_AUDIT[action.type](action), "follow_up", action.planId, {
      action: action.type,
      ...(action.type === "stop" && { reason: action.reason }),
      ...((action.type === "link" || action.type === "unlink") && {
        appointmentId: action.appointmentId,
      }),
    });
    refresh();
    return { ok: true, message: ACTION_DONE[action.type] };
  } catch (error) {
    return failure("panel.follow_up_action.failed", error);
  }
}

// ─── Rules and settings (clinicSettings.update) ──────────────────────────────

export async function saveFollowUpRule(
  ruleId: string | null,
  input: unknown,
): Promise<SettingsResult> {
  const context = await followUpContext({ clinicSettings: ["update"] });
  if (ruleId !== null && !z.uuid().safeParse(ruleId).success) {
    return { ok: false, message: "Kural bulunamadı." };
  }
  const parsed = followUpRuleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  try {
    const id = await saveRule(db(), context.clinic.id, ruleId, parsed.data);
    await audit(context, "follow_up_rule.saved", "follow_up_rule", id, {
      created: ruleId === null,
      active: parsed.data.isActive,
    });
    refresh();
    return {
      ok: true,
      message: ruleId
        ? "Kural kaydedildi. Mevcut takipler değişmez; yeni takipler bu kuralla başlar."
        : "Kural oluşturuldu.",
    };
  } catch (error) {
    return failure("panel.follow_up_rule.failed", error);
  }
}

export async function archiveFollowUpRule(ruleId: string): Promise<SettingsResult> {
  const context = await followUpContext({ clinicSettings: ["update"] });
  if (!z.uuid().safeParse(ruleId).success) return { ok: false, message: "Kural bulunamadı." };
  try {
    await archiveRule(db(), context.clinic.id, ruleId, new Date());
    await audit(context, "follow_up_rule.archived", "follow_up_rule", ruleId);
    refresh();
    return { ok: true, message: "Kural arşivlendi. Mevcut takipler devam eder." };
  } catch (error) {
    return failure("panel.follow_up_rule_archive.failed", error);
  }
}

export async function duplicateFollowUpRule(ruleId: string): Promise<SettingsResult> {
  const context = await followUpContext({ clinicSettings: ["update"] });
  if (!z.uuid().safeParse(ruleId).success) return { ok: false, message: "Kural bulunamadı." };
  try {
    const id = await duplicateRule(db(), context.clinic.id, ruleId);
    await audit(context, "follow_up_rule.saved", "follow_up_rule", id, { duplicatedFrom: ruleId });
    refresh();
    return { ok: true, message: "Kopya oluşturuldu (pasif)." };
  } catch (error) {
    return failure("panel.follow_up_rule_duplicate.failed", error);
  }
}

export async function addFollowUpExamples(template: string): Promise<SettingsResult> {
  const context = await followUpContext({ clinicSettings: ["update"] });
  const parsed = z.enum(CLINIC_TEMPLATE_KEYS as [string, ...string[]]).safeParse(template);
  if (!parsed.success) return { ok: false, message: "Şablon bulunamadı." };
  try {
    const added = await addExampleRules(
      db(),
      context.clinic.id,
      parsed.data as (typeof CLINIC_TEMPLATE_KEYS)[number],
    );
    if (added > 0) {
      await audit(context, "follow_up_rule.examples_added", "clinic", context.clinic.id, {
        template: parsed.data,
        added,
      });
    }
    refresh();
    return {
      ok: true,
      message:
        added > 0
          ? `${added} örnek kural eklendi. Aralıkları siz belirleyip etkinleştirin.`
          : "Eklenecek yeni örnek yok (hizmet adları eşleşmedi ya da zaten eklenmiş).",
    };
  } catch (error) {
    return failure("panel.follow_up_examples.failed", error);
  }
}

const followUpSettingsSchema = z.object({
  smsReminders: z.boolean(),
  dueSoonDays: z.number().int().min(1, "En az 1 gün.").max(60, "En fazla 60 gün."),
});

export async function saveFollowUpSettings(input: unknown): Promise<SettingsResult> {
  const context = await followUpContext({ clinicSettings: ["update"] });
  const parsed = followUpSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  try {
    await updateFollowUpSettings(db(), context.clinic.id, parsed.data);
    await audit(context, "follow_up.settings_updated", "clinic", context.clinic.id, {
      smsReminders: parsed.data.smsReminders,
      dueSoonDays: parsed.data.dueSoonDays,
    });
    refresh();
    return { ok: true, message: "Takip ayarları kaydedildi." };
  } catch (error) {
    return failure("panel.follow_up_settings.failed", error);
  }
}
