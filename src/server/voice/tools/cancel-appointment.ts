import "server-only";

import { z } from "zod";

import { cancelAppointment } from "../../domain/appointments";
import { markCallOutcome } from "../../domain/calls";
import { spokenDate, spokenTime } from "../../domain/speech";
import { enqueueAppointmentMessage } from "../../domain/notifications";
import { ownershipCheck, resolveCaller, withOwnershipCheck } from "./caller";
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
    verification: ownershipCheck.optional(),
  }),
  async handler(ctx, input) {
    const { clinic, settings } = ctx.clinic;
    const caller = resolveCaller(ctx, input.phone);
    const cancel = (check?: Parameters<typeof cancelAppointment>[2]["check"]) =>
      cancelAppointment(ctx.db, ctx.clinic, {
        appointmentId: input.appointmentId,
        phone: caller.phone,
        check,
        now: ctx.now,
      });
    const appointment = caller.trusted
      ? await cancel()
      : await withOwnershipCheck(ctx, caller.phone, input.verification, cancel);

    if (ctx.callId) await markCallOutcome(ctx.db, clinic.id, ctx.callId, "cancelled");
    // A repeated request reports the earlier cancellation and sends nothing new.
    if (!appointment.alreadyCancelled && settings.notifications.smsConfirmation) {
      await enqueueAppointmentMessage(ctx.db, {
        clinicId: clinic.id,
        kind: "appointment_cancellation",
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        now: ctx.now,
      });
      ctx.sendQueuedMessages();
    }

    return {
      ok: true,
      cancelled: {
        date: appointment.date,
        spokenDate: spokenDate(appointment.date),
        time: appointment.time,
        spokenTime: spokenTime(appointment.time),
        service: appointment.serviceName,
      },
      alreadyCancelled: Boolean(appointment.alreadyCancelled),
      hint: "Hastaya yeni bir randevu almak isteyip istemediğini sor.",
    };
  },
});
