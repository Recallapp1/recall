"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { callReportSchema } from "@/lib/contracts/call";
import { env } from "@/lib/env";
import { safeError } from "@/lib/safe-error";
import { requirePanelScope } from "@/server/auth/session";
import { db } from "@/server/db";
import { recordAudit } from "@/server/domain/audit";
import { getCall } from "@/server/domain/panel";
import { recordingTarget } from "@/server/domain/recording-access";
import { freshRecordingUrl, RECORDING_PROVIDERS } from "@/server/voice/sync";

/**
 * Hands out a short-lived recording link only to roles with
 * `calls.listen_recording` and records every playback (KVKK: recordings are
 * health data). The stored link is just a marker; signed links expire.
 */
export async function getRecordingUrl(
  callId: string,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const { context, scope } = await requirePanelScope({ calls: ["listen_recording"] });
  if (!z.uuid().safeParse(callId).success) return { ok: false, message: "Kayıt bulunamadı." };

  const call = await getCall(db(), scope, callId);
  // Bound to the authorised row: this clinic, a supported provider, a provider call id.
  const target = call
    ? recordingTarget(call, { clinicId: context.clinic.id, providers: RECORDING_PROVIDERS })
    : null;
  if (!target) return { ok: false, message: "Bu aramanın kaydı yok." };

  let url: string | null;
  try {
    url = await freshRecordingUrl(target.providerCallId);
  } catch (error) {
    console.error(JSON.stringify({ msg: "call.recording_fetch_failed", error: safeError(error) }));
    return { ok: false, message: "Kayıt şu anda açılamadı. Lütfen tekrar deneyin." };
  }
  if (!url) return { ok: false, message: "Bu kaydın saklama süresi doldu." };

  // No playback without its trace: a failed audit write keeps the link back.
  try {
    await recordAudit(db(), {
      clinicId: context.clinic.id,
      actorUserId: context.session.user.id,
      action: "call.recording_played",
      targetType: "call",
      targetId: callId,
    });
  } catch {
    return { ok: false, message: "Kayıt şu anda açılamıyor. Recall ekibi bilgilendirildi." };
  }
  return { ok: true, url };
}

/**
 * A staff member reports wrong assistant behaviour on a call (CALL_REVIEW,
 * R2 5d): a reason from a fixed list, kept in the audit log for the Recall
 * team to review. No free text, so no patient data reaches the log.
 */
export async function reportCall(
  input: unknown,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const { context, scope } = await requirePanelScope({ calls: ["read"] });
  if (env().CALL_REVIEW !== true) return { ok: false, message: "Bu özellik kapalı." };
  const parsed = callReportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Bir sebep seçin." };
  const call = await getCall(db(), scope, parsed.data.callId);
  if (!call) return { ok: false, message: "Arama bulunamadı." };
  try {
    await recordAudit(db(), {
      clinicId: context.clinic.id,
      actorUserId: context.session.user.id,
      action: "call.reported",
      targetType: "call",
      targetId: call.id,
      metadata: { reason: parsed.data.reason },
    });
  } catch (error) {
    console.error(JSON.stringify({ msg: "panel.call_report.failed", error: safeError(error) }));
    return { ok: false, message: "Bildirim şu anda kaydedilemedi." };
  }
  revalidatePath(`/panel/aramalar/${call.id}`);
  return { ok: true, message: "Bildiriminiz kaydedildi. Recall ekibi inceleyecek." };
}

/**
 * Marks or unmarks a call as a test call (TEST_CALL_FLAG, R2 5e). Owners
 * and admins (assistantSettings.update), who make the test calls; audited.
 */
export async function markTestCall(
  input: unknown,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const { context, scope } = await requirePanelScope({ assistantSettings: ["update"] });
  if (env().TEST_CALL_FLAG !== true) return { ok: false, message: "Bu özellik kapalı." };
  const parsed = z.object({ callId: z.uuid(), test: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "İstek geçersiz." };
  const call = await getCall(db(), scope, parsed.data.callId);
  if (!call) return { ok: false, message: "Arama bulunamadı." };
  try {
    await recordAudit(db(), {
      clinicId: context.clinic.id,
      actorUserId: context.session.user.id,
      action: "call.marked_test",
      targetType: "call",
      targetId: call.id,
      metadata: { test: parsed.data.test },
    });
  } catch (error) {
    console.error(JSON.stringify({ msg: "panel.call_test_mark.failed", error: safeError(error) }));
    return { ok: false, message: "İşaret şu anda kaydedilemedi." };
  }
  revalidatePath(`/panel/aramalar/${call.id}`);
  revalidatePath("/panel");
  return {
    ok: true,
    message: parsed.data.test
      ? "Test araması olarak işaretlendi; günlük sayılara katılmaz."
      : "Test işareti kaldırıldı.",
  };
}
