import "server-only";

import { z } from "zod";

import { rescheduleAppointment } from "../../domain/appointments";
import { markCallOutcome } from "../../domain/calls";
import { DomainError } from "../../domain/errors";
import { spokenTitles } from "../../domain/speech";
import { spokenDate, spokenTime } from "../../domain/speech";
import { enqueueAppointmentMessage } from "../../domain/notifications";
import { ownershipCheck, resolveCaller, withOwnershipCheck } from "./caller";
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
    verification: ownershipCheck.optional(),
  }),
  async handler(ctx, input) {
    if (ctx.clinic.clinic.status === "paused") {
      throw new DomainError("CLINIC_PAUSED", "Klinik şu anda yeni randevu almıyor.");
    }
    const { clinic, settings } = ctx.clinic;
    const caller = resolveCaller(ctx, input.phone);
    const { verification, ...change } = input;
    const reschedule = (check?: Parameters<typeof rescheduleAppointment>[2]["check"]) =>
      rescheduleAppointment(ctx.db, ctx.clinic, {
        ...change,
        phone: caller.phone,
        check,
        callId: ctx.callId,
        now: ctx.now,
      });
    const { previous, appointment } = caller.trusted
      ? await reschedule()
      : await withOwnershipCheck(ctx, caller.phone, verification, reschedule);

    if (ctx.callId) await markCallOutcome(ctx.db, clinic.id, ctx.callId, "rescheduled");
    if (settings.notifications.smsConfirmation) {
      await enqueueAppointmentMessage(ctx.db, {
        clinicId: clinic.id,
        kind: "appointment_rescheduled",
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        now: ctx.now,
      });
      ctx.sendQueuedMessages();
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
        practitioner: spokenTitles(appointment.practitionerName),
      },
    };
  },
});
