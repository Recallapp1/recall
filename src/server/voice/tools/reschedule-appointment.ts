import "server-only";

import { z } from "zod";

import { rescheduleAppointment } from "../../domain/appointments";
import { markCallOutcome } from "../../domain/calls";
import { DomainError } from "../../domain/errors";
import { spokenDate, spokenTime } from "../../domain/speech";
import { sendSmsSafely, smsTemplates } from "../../notifications/sms";
import { defineTool } from "./define";
import { entityId, localDate, localTime, phone } from "./schemas";

export const rescheduleAppointmentTool = defineTool({
  name: "reschedule_appointment",
  description:
    "Mevcut randevuyu yeni bir tarih ve saate taşır. Yeni saat check_availability ile doğrulanmış olmalı ve hasta onaylamış olmalı. Yeni saat alınamazsa eski randevu korunur.",
  fillerMessage: "Randevunuzu güncelliyorum.",
  input: z.object({
    appointmentId: entityId("Randevu").describe("find_appointments sonucundaki appointmentId"),
    date: localDate,
    time: localTime,
    practitionerId: entityId("Hekim").optional().describe("Hekim değişecekse"),
    phone: phone.optional(),
  }),
  async handler(ctx, input) {
    if (ctx.clinic.clinic.status === "paused") {
      throw new DomainError("CLINIC_PAUSED", "Klinik şu anda yeni randevu almıyor.");
    }
    const { clinic, settings } = ctx.clinic;
    const { previous, appointment } = await rescheduleAppointment(ctx.db, ctx.clinic, {
      ...input,
      phone: input.phone ?? ctx.callerPhone,
      callId: ctx.callId,
      now: ctx.now,
    });

    if (ctx.callId) await markCallOutcome(ctx.db, clinic.id, ctx.callId, "rescheduled");
    if (settings.notifications.smsConfirmation) {
      ctx.defer(() =>
        sendSmsSafely(
          appointment.patientPhone,
          smsTemplates.rescheduled(clinic.name, appointment),
          {
            clinicId: clinic.id,
            appointmentId: appointment.id,
          },
        ),
      );
    }

    return {
      ok: true,
      previous: { spokenDate: spokenDate(previous.date), spokenTime: spokenTime(previous.time) },
      appointment: {
        appointmentId: appointment.id,
        date: appointment.date,
        spokenDate: spokenDate(appointment.date),
        time: appointment.time,
        spokenTime: spokenTime(appointment.time),
        service: appointment.serviceName,
        practitioner: appointment.practitionerName,
      },
    };
  },
});
