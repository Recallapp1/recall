"use server";

import { revalidatePath } from "next/cache";

import { STATUS_DONE_MESSAGES } from "@/lib/contracts/appointment";
import { fieldErrors, type FormState } from "@/lib/contracts/form-state";
import {
  appointmentNotesSchema,
  availabilityQuerySchema,
  changeStatusSchema,
  createAppointmentSchema,
  type CreateAppointmentField,
} from "@/lib/contracts/panel-appointment";
import { safeError } from "@/lib/safe-error";
import { requirePanelScope } from "@/server/auth/session";
import { db } from "@/server/db";
import { bookAppointment } from "@/server/domain/appointments";
import { recordAudit } from "@/server/domain/audit";
import { DomainError } from "@/server/domain/errors";
import { changeAppointmentStatus, updateAppointmentNotes } from "@/server/domain/panel";
import { findAvailability } from "@/server/domain/scheduling";

const TRY_AGAIN = "İşlem şu anda yapılamadı. Lütfen tekrar deneyin.";

function fail(event: string, error: unknown): { ok: false; message: string } {
  if (error instanceof DomainError) return { ok: false, message: error.userMessage };
  console.error(JSON.stringify({ msg: event, error: safeError(error) }));
  return { ok: false, message: TRY_AGAIN };
}

export interface SlotOption {
  time: string;
  practitionerId: string;
  practitionerName: string;
}

/** Free slots for the "new appointment" form. */
export async function getAvailableSlots(input: {
  serviceId: string;
  practitionerId?: string;
  date: string;
}): Promise<
  { ok: true; slots: SlotOption[]; nextAvailableDates: string[] } | { ok: false; message: string }
> {
  const { context } = await requirePanelScope({ appointments: ["create"] });
  const parsed = availabilityQuerySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Hizmet ve tarih seçin." };

  try {
    const result = await findAvailability(db(), context, { ...parsed.data, now: new Date() });
    return {
      ok: true,
      slots: result.slots.map((slot) => ({
        time: slot.time,
        practitionerId: slot.practitionerId,
        practitionerName: slot.practitionerName,
      })),
      nextAvailableDates: result.nextAvailableDates,
    };
  } catch (error) {
    return fail("panel.availability.failed", error);
  }
}

export async function createAppointment(
  _previous: FormState<CreateAppointmentField>,
  formData: FormData,
): Promise<FormState<CreateAppointmentField>> {
  const { context } = await requirePanelScope({ appointments: ["create"] });
  const parsed = createAppointmentSchema.safeParse({
    serviceId: formData.get("serviceId") ?? "",
    practitionerId: formData.get("practitionerId") ?? "",
    date: formData.get("date") ?? "",
    time: formData.get("time") ?? "",
    patientName: formData.get("patientName") ?? "",
    patientPhone: formData.get("patientPhone") ?? "",
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Lütfen işaretli alanları kontrol edin.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  try {
    const { appointment, created } = await bookAppointment(db(), context, {
      ...parsed.data,
      source: "panel",
      now: new Date(),
    });
    if (created) {
      await recordAudit(db(), {
        clinicId: context.clinic.id,
        actorUserId: context.session.user.id,
        action: "appointment.created",
        targetType: "appointment",
        targetId: appointment.id,
        metadata: { source: "panel" },
      });
    }
    revalidatePath("/panel", "layout");
    return {
      status: "success",
      message: created ? "Randevu oluşturuldu." : "Bu hasta için aynı randevu zaten var.",
    };
  } catch (error) {
    const result = fail("panel.appointment_create.failed", error);
    return { status: "error", message: result.message };
  }
}

export async function setAppointmentStatus(input: {
  appointmentId: string;
  status: string;
}): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const parsed = changeStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: TRY_AGAIN };
  const { context, scope } = await requirePanelScope({
    appointments: [parsed.data.status === "cancelled" ? "cancel" : "update"],
  });

  try {
    const { previous } = await changeAppointmentStatus(db(), scope, {
      ...parsed.data,
      now: new Date(),
    });
    await recordAudit(db(), {
      clinicId: context.clinic.id,
      actorUserId: context.session.user.id,
      action: "appointment.status_changed",
      targetType: "appointment",
      targetId: parsed.data.appointmentId,
      metadata: { from: previous, to: parsed.data.status },
    });
    revalidatePath("/panel", "layout");
    return { ok: true, message: STATUS_DONE_MESSAGES[parsed.data.status] };
  } catch (error) {
    return fail("panel.appointment_status.failed", error);
  }
}

export async function saveAppointmentNotes(
  _previous: FormState<"notes">,
  formData: FormData,
): Promise<FormState<"notes">> {
  const { context, scope } = await requirePanelScope({ appointments: ["update"] });
  const parsed = appointmentNotesSchema.safeParse({
    appointmentId: formData.get("appointmentId") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Not kaydedilemedi.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  try {
    await updateAppointmentNotes(db(), scope, parsed.data);
    await recordAudit(db(), {
      clinicId: context.clinic.id,
      actorUserId: context.session.user.id,
      action: "appointment.updated",
      targetType: "appointment",
      targetId: parsed.data.appointmentId,
      metadata: { fields: ["notes"] },
    });
    revalidatePath("/panel", "layout");
    return { status: "success", message: "Not kaydedildi." };
  } catch (error) {
    return { status: "error", message: fail("panel.appointment_notes.failed", error).message };
  }
}
