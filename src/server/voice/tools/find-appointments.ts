import "server-only";

import { z } from "zod";

import { maskName } from "@/lib/phone";

import { findUpcomingAppointments } from "../../domain/appointments";
import { spokenDate, spokenTime } from "../../domain/speech";
import { defineTool } from "./define";
import { phone } from "./schemas";

export const findAppointments = defineTool({
  name: "find_appointments",
  description:
    "Arayan hastanın gelecekteki randevularını bulur. İptal veya erteleme isteğinde önce bunu çağır.",
  fillerMessage: "Randevularınıza bakıyorum.",
  input: z.object({ phone: phone.optional() }),
  async handler(ctx, input) {
    const appointments = await findUpcomingAppointments(
      ctx.db,
      ctx.clinic,
      input.phone ?? ctx.callerPhone,
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
        practitioner: a.practitionerName,
        // Initials only: enough to confirm identity without disclosing data.
        patient: maskName(a.patientName),
      })),
      hint: appointments.length === 0 ? "Bu numaraya kayıtlı gelecek randevu yok." : undefined,
    };
  },
});
