"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";

import type { FormState } from "@/lib/contracts/form-state";
import { safeError } from "@/lib/safe-error";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { recordAudit, withAudit } from "@/server/domain/audit";
import { DomainError } from "@/server/domain/errors";
import { anonymizePatient, setPatientSmsOptOut, updatePatientNotes } from "@/server/domain/panel";
import { deleteProviderCalls } from "@/server/voice/sync";

const notesSchema = z.object({
  patientId: z.uuid(),
  notes: z.string().trim().max(1000, "Not en fazla 1000 karakter olabilir."),
});

export async function savePatientNotes(
  _previous: FormState<"notes">,
  formData: FormData,
): Promise<FormState<"notes">> {
  const { clinic, session } = await requirePermission({ patients: ["update"] });
  const parsed = notesSchema.safeParse({
    patientId: formData.get("patientId") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Not kaydedilemedi." };
  }
  try {
    await updatePatientNotes(db(), clinic.id, parsed.data);
    await recordAudit(db(), {
      clinicId: clinic.id,
      actorUserId: session.user.id,
      action: "patient.updated",
      targetType: "patient",
      targetId: parsed.data.patientId,
      metadata: { fields: ["notes"] },
    });
    revalidatePath(`/panel/hastalar/${parsed.data.patientId}`);
    return { status: "success", message: "Not kaydedildi." };
  } catch (error) {
    if (error instanceof DomainError) return { status: "error", message: error.userMessage };
    console.error(JSON.stringify({ msg: "panel.patient_notes.failed", error: safeError(error) }));
    return { status: "error", message: "Not şu anda kaydedilemedi." };
  }
}

/** KVKK erasure. Irreversible; the UI asks for confirmation first. */
export async function anonymizePatientAction(
  patientId: string,
): Promise<{ ok: false; message: string }> {
  const { clinic, session } = await requirePermission({ patients: ["anonymize"] });
  if (!z.uuid().safeParse(patientId).success) return { ok: false, message: "Hasta bulunamadı." };
  try {
    // Erasure and its audit record commit together or not at all.
    const providerCalls = await withAudit(
      db(),
      {
        clinicId: clinic.id,
        actorUserId: session.user.id,
        action: "patient.anonymized",
        targetType: "patient",
        targetId: patientId,
      },
      (tx) => anonymizePatient(tx, clinic.id, patientId),
    );
    // The voice platform still holds the audio of those calls; erase it too.
    after(async () => {
      try {
        await deleteProviderCalls(providerCalls);
      } catch (error) {
        console.error(
          JSON.stringify({
            msg: "panel.patient_anonymize.provider_failed",
            error: safeError(error),
          }),
        );
      }
    });
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, message: error.userMessage };
    console.error(
      JSON.stringify({ msg: "panel.patient_anonymize.failed", error: safeError(error) }),
    );
    return { ok: false, message: "İşlem şu anda yapılamadı." };
  }
  revalidatePath("/panel", "layout");
  redirect("/panel/hastalar?durum=anonimlestirildi");
}

/** "SMS istemiyor": channel-level opt-out, audited (TAKIP.md, V1 decision 3). */
export async function setSmsOptOut(
  patientId: string,
  optOut: boolean,
): Promise<{ ok: boolean; message: string }> {
  const { clinic, session } = await requirePermission({ patients: ["update"] });
  if (!z.uuid().safeParse(patientId).success) return { ok: false, message: "Hasta bulunamadı." };
  try {
    await setPatientSmsOptOut(db(), clinic.id, patientId, optOut, new Date());
    await recordAudit(db(), {
      clinicId: clinic.id,
      actorUserId: session.user.id,
      action: optOut ? "patient.sms_opt_out" : "patient.sms_opt_in",
      targetType: "patient",
      targetId: patientId,
    });
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, message: error.userMessage };
    console.error(
      JSON.stringify({ msg: "panel.patient_sms_opt_out.failed", error: safeError(error) }),
    );
    return { ok: false, message: "İşlem şu anda yapılamadı." };
  }
  revalidatePath("/panel", "layout");
  return {
    ok: true,
    message: optOut ? "Hastaya SMS gönderilmeyecek." : "Hastaya yeniden SMS gönderilebilir.",
  };
}
