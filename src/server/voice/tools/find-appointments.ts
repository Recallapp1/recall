import "server-only";

import { z } from "zod";

import { maskName } from "@/lib/phone";

import { findUpcomingAppointments, findVerifiedAppointments } from "../../domain/appointments";
import { DomainError } from "../../domain/errors";
import { spokenDate, spokenTime, spokenTitles } from "../../domain/speech";
import { ownershipCheck, resolveCaller, withOwnershipCheck } from "./caller";
import { defineTool } from "./define";
import { phone } from "./schemas";

export const findAppointments = defineTool({
  name: "find_appointments",
  description:
    "Arayan hastanın gelecekteki randevularını bulur. İptal veya erteleme isteğinde önce bunu çağır. Arayan numara görünmüyorsa telefonla birlikte verification (ad soyad, randevu tarihi ve saati) gerekir.",
  fillerMessage: "Randevularınıza bakıyorum.",
  input: z.object({ phone: phone.optional(), verification: ownershipCheck.optional() }),
  async handler(ctx, input) {
    const caller = resolveCaller(ctx, input.phone);

    if (caller.trusted) {
      const appointments = await findUpcomingAppointments(
        ctx.db,
        ctx.clinic,
        caller.phone,
        ctx.now,
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
        hint: caller.ignoredSpokenNumber
          ? "Telefonla yalnızca arayan numaraya kayıtlı randevular yönetilebilir. Başka bir numaraya kayıtlı randevu için klinik ekibinin geri aramasını öner."
          : appointments.length === 0
            ? "Bu numaraya kayıtlı gelecek randevu yok."
            : undefined,
      };
    }

    // No caller ID: the same answer for every number until ownership is shown.
    if (!input.verification) {
      if (!input.phone?.trim()) {
        throw new DomainError(
          "PHONE_REQUIRED",
          "Randevularınızı bulmak için telefon numaranız gerekiyor.",
        );
      }
      return {
        ok: true,
        verificationRequired: true,
        hint: "Arayan numara görünmüyor. Randevu olup olmadığını söyleme. Hastadan randevunun kayıtlı olduğu ad soyadı, randevu tarihini ve saatini iste; sonra find_appointments'ı phone ve verification ile tekrar çağır.",
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
      })),
      hint: "Doğrulama tamam. İptal veya erteleme için aynı phone ve verification bilgilerini gönder.",
    };
  },
});
