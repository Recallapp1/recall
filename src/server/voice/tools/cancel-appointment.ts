import "server-only";

import { z } from "zod";

import { cancelAppointment } from "../../domain/appointments";
import { markCallOutcome } from "../../domain/calls";
import { spokenDate } from "../../domain/time";
import { sendSmsSafely, smsTemplates } from "../../notifications/sms";
import { defineTool } from "./define";
import { entityId, phone } from "./schemas";

export const cancelAppointmentTool = defineTool({
  name: "cancel_appointment",
  description:
    "Randevuyu iptal eder. Sadece find_appointments ile bulunan bir randevu için ve hasta iptali açıkça onayladıktan sonra çağır.",
  fillerMessage: "İptal ediyorum.",
  input: z.object({
    appointmentId: entityId("Randevu").describe("find_appointments sonucundaki appointmentId"),
    phone: phone.optional(),
  }),
  async handler(ctx, input) {
    const { clinic, settings } = ctx.clinic;
    const appointment = await cancelAppointment(ctx.db, ctx.clinic, {
      appointmentId: input.appointmentId,
      phone: input.phone ?? ctx.callerPhone,
      now: ctx.now,
    });

    if (ctx.callId) await markCallOutcome(ctx.db, clinic.id, ctx.callId, "cancelled");
    if (settings.notifications.smsConfirmation) {
      ctx.defer(() =>
        sendSmsSafely(
          appointment.patientPhone,
          smsTemplates.cancellation(clinic.name, appointment),
          {
            clinicId: clinic.id,
            appointmentId: appointment.id,
          },
        ),
      );
    }

    return {
      ok: true,
      cancelled: {
        date: appointment.date,
        spokenDate: spokenDate(appointment.date),
        time: appointment.time,
        service: appointment.serviceName,
      },
      hint: "Hastaya yeni bir randevu almak isteyip istemediğini sor.",
    };
  },
});
