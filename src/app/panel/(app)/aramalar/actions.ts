"use server";

import { z } from "zod";

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
