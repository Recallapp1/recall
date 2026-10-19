import "server-only";

import { z } from "zod";

import { maskName } from "@/lib/phone";

import { findUpcomingAppointments, findVerifiedAppointments } from "../../domain/appointments";
import { linkCallToPatients } from "../../domain/call-patients";
import { DomainError } from "../../domain/errors";
import { spokenDate, spokenTime, spokenTitles } from "../../domain/speech";
import { needsOwnershipCheck, ownershipCheck, resolveCaller, withOwnershipCheck } from "./caller";
import { defineTool } from "./define";
import { phone } from "./schemas";

/**
 * VOICE_VERIFY_HINT: in the 19 Oct eval the caller gave name, date and time
 * in one breath; the assistant called with the phone only, then asked for
 * them twice and never called again.
 */
const ASK_ONLY_MISSING = (with_: string) =>
  `Hasta randevunun kayıtlı olduğu ad soyadı, randevu tarihini ve saatini bu görüşmede zaten söylediyse tekrar sorma: hemen find_appointments'ı ${with_} tekrar çağır. Bunlardan eksik olan varsa yalnızca eksiği sor, sonra çağır.`;

export const findAppointments = defineTool({
  name: "find_appointments",
  description:
    "Arayan hastanın gelecekteki randevularını bulur. İptal veya erteleme isteğinde önce bunu çağır. Arayan numara görünmüyorsa telefonla birlikte verification (ad soyad, randevu tarihi ve saati) gerekir.",
  fillerMessage: "Randevularınıza bakıyorum.",
  input: z.object({ phone: phone.optional(), verification: ownershipCheck.optional() }),
  async handler(ctx, input) {
    const caller = resolveCaller(ctx, input.phone);
    const verify = await needsOwnershipCheck(ctx, caller);

    if (!verify) {
      const appointments = await findUpcomingAppointments(
        ctx.db,
        ctx.clinic,
        caller.phone,
        ctx.now,
      );
      await linkCallToPatients(
        ctx.db,
        ctx.clinic.clinic.id,
        ctx.callId,
        appointments.map((a) => a.patientId),
      );
      return {
        ok: true,
        appointments: appointments.map((a) => ({
          appointmentId: a.id,
          date: a.date,
          spokenDate: spokenDate(a.date),
          time: a.time,
          spokenTime: spokenTime(a.time),
          service: a.serviceName,
          practitioner: spokenTitles(a.practitionerName),
          // Initials only: enough to confirm identity without disclosing data.
          patient: maskName(a.patientName),
        })),
        hint:
          caller.trusted && caller.ignoredSpokenNumber
            ? "Telefonla yalnızca arayan numaraya kayıtlı randevular yönetilebilir. Başka bir numaraya kayıtlı randevu için klinik ekibinin geri aramasını öner."
            : appointments.length === 0
              ? "Bu numaraya kayıtlı gelecek randevu yok."
              : undefined,
      };
    }

    // No caller ID, or a number shared by several people: the same answer for
    // every number until ownership is shown, and only the matching appointment.
    if (!input.verification) {
      if (caller.trusted) {
        return {
          ok: true,
          verificationRequired: true,
          hint: ctx.verifyHint
            ? `Bu numaraya birden fazla kişi adına randevu kayıtlı olabilir. Randevu olup olmadığını veya kimin adına olduğunu söyleme. ${ASK_ONLY_MISSING("verification ile")}`
            : "Bu numaraya birden fazla kişi adına randevu kayıtlı olabilir. Randevu olup olmadığını veya kimin adına olduğunu söyleme. Hastadan randevunun kayıtlı olduğu ad soyadı, randevu tarihini ve saatini iste; sonra find_appointments'ı verification ile tekrar çağır.",
        };
      }
      if (!input.phone?.trim()) {
        throw new DomainError(
          "PHONE_REQUIRED",
          "Randevularınızı bulmak için telefon numaranız gerekiyor.",
        );
      }
      return {
        ok: true,
        verificationRequired: true,
        hint: ctx.verifyHint
          ? `Arayan numara görünmüyor; henüz hiçbir randevu bulunmadı. Randevu olup olmadığını söyleme. ${ASK_ONLY_MISSING("phone ve verification ile")} O çağrının sonucu gelmeden randevuyu bulduğunu söyleme.`
          : "Arayan numara görünmüyor; henüz hiçbir randevu bulunmadı. Randevu olup olmadığını söyleme. Hastadan randevunun kayıtlı olduğu ad soyadı, randevu tarihini ve saatini iste; sonra find_appointments'ı phone ve verification ile tekrar çağır. O çağrının sonucu gelmeden randevuyu bulduğunu söyleme.",
      };
    }

    const verified = await withOwnershipCheck(
      ctx,
      caller.phone,
      input.verification,
      async (check) => {
        const matches = await findVerifiedAppointments(
          ctx.db,
          ctx.clinic,
          caller.phone,
          check,
          ctx.now,
        );
        if (matches.length === 0) throw new DomainError("VERIFICATION_FAILED", "Eşleşme yok.");
        await linkCallToPatients(
          ctx.db,
          ctx.clinic.clinic.id,
          ctx.callId,
          matches.map((a) => a.patientId),
        );
        return matches;
      },
    );
    return {
      ok: true,
      // Only what the caller already said: no service, practitioner or name.
      appointments: verified.map((a) => ({
        appointmentId: a.id,
        date: a.date,
        spokenDate: spokenDate(a.date),
        time: a.time,
        spokenTime: spokenTime(a.time),
        // VOICE_VERIFIED_SERVICE: an id, not words; a move needs it for check_availability.
        ...(ctx.verifiedService && { serviceId: a.serviceId }),
      })),
      hint: ctx.verifiedService
        ? "Doğrulama tamam. Erteleme için check_availability'yi bu randevunun serviceId'siyle çağır; hastaya hizmeti sorma. İptal veya erteleme için aynı phone ve verification bilgilerini gönder."
        : "Doğrulama tamam. İptal veya erteleme için aynı phone ve verification bilgilerini gönder.",
    };
  },
});
