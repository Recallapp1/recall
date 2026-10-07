import "server-only";

import { z } from "zod";

import { normalizePhone } from "@/lib/phone";

import { bookAppointment } from "../../domain/appointments";
import { markCallOutcome } from "../../domain/calls";
import { DomainError } from "../../domain/errors";
import { spokenTitles } from "../../domain/speech";
import { spokenDate, spokenTime } from "../../domain/speech";
import { sendSmsSafely, smsTemplates } from "../../notifications/sms";
import { defineTool } from "./define";
import { entityId, localDate, localTime, phone } from "./schemas";

export const bookAppointmentTool = defineTool({
  name: "book_appointment",
  description:
    "Randevu oluşturur. Sadece check_availability'nin döndürdüğü bir saat için ve hasta hizmeti, günü ve saati açıkça onayladıktan sonra çağır. Hasta açıkça birden fazla hizmet istemedikçe bir görüşmede tek randevu oluştur; aynı saate ikinci randevu oluşturma.",
  fillerMessage: "Randevunuzu oluşturuyorum.",
  input: z.object({
    serviceId: entityId("Hizmet"),
    practitionerId: entityId("Hekim").describe("check_availability sonucundaki practitionerId"),
    date: localDate,
    time: localTime,
    patientName: z.string().min(2).max(100).describe("Hastanın adı ve soyadı"),
    patientPhone: phone.optional(),
    notes: z.string().max(500).optional().describe("Hastanın belirttiği kısa not (şikâyet vb.)"),
  }),
  async handler(ctx, input) {
    if (ctx.clinic.clinic.status === "paused") {
      throw new DomainError("CLINIC_PAUSED", "Klinik şu anda yeni randevu almıyor.");
    }
    const { clinic, settings } = ctx.clinic;
    const spokenPhone = normalizePhone(input.patientPhone);
    const { appointment, created } = await bookAppointment(ctx.db, ctx.clinic, {
      ...input,
      patientPhone: input.patientPhone ?? ctx.callerPhone,
      // Booking for a family member's number is allowed; it just discloses nothing.
      phoneUnverified: spokenPhone !== null && spokenPhone !== ctx.callerPhone,
      source: "voice",
      callId: ctx.callId,
      now: ctx.now,
    });

    if (ctx.callId) await markCallOutcome(ctx.db, clinic.id, ctx.callId, "booked");

    const smsSent = created && settings.notifications.smsConfirmation && ctx.smsDelivers;
    if (smsSent) {
      ctx.defer(() =>
        sendSmsSafely(
          appointment.patientPhone,
          smsTemplates.confirmation(clinic.name, appointment, clinic.address),
          {
            clinicId: clinic.id,
            appointmentId: appointment.id,
          },
        ),
      );
    }

    return {
      ok: true,
      appointmentId: appointment.id,
      date: appointment.date,
      spokenDate: spokenDate(appointment.date),
      time: appointment.time,
      spokenTime: spokenTime(appointment.time),
      service: appointment.serviceName,
      practitioner: spokenTitles(appointment.practitionerName),
      alreadyExisted: !created,
      smsSent,
    };
  },
});
