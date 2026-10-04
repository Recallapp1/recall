"use server";

import { z } from "zod";

import { requirePanelScope } from "@/server/auth/session";
import { db } from "@/server/db";
import { recordAudit } from "@/server/domain/audit";
import { getCall } from "@/server/domain/panel";

/**
 * Hands out the recording URL only to roles with `calls.listen_recording`
 * and records every playback (KVKK: recordings are health data).
 */
export async function getRecordingUrl(
  callId: string,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const { context, scope } = await requirePanelScope({ calls: ["listen_recording"] });
  if (!z.uuid().safeParse(callId).success) return { ok: false, message: "Kayıt bulunamadı." };

  const call = await getCall(db(), scope, callId);
  if (!call?.recordingUrl) return { ok: false, message: "Bu aramanın kaydı yok." };

  await recordAudit(db(), {
    clinicId: context.clinic.id,
    actorUserId: context.session.user.id,
    action: "call.recording_played",
    targetType: "call",
    targetId: callId,
  });
  return { ok: true, url: call.recordingUrl };
}
