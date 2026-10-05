import { z } from "zod";

import { normalizePhone } from "../phone";
import { APPOINTMENT_SOURCES, APPOINTMENT_STATUSES } from "./appointment";

/** Panel forms and server actions for appointments (shared contract). */

export const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir tarih seçin.");
const localTime = z.string().regex(/^\d{2}:\d{2}$/, "Bir saat seçin.");

export const createAppointmentSchema = z.object({
  serviceId: z.uuid("Bir hizmet seçin."),
  practitionerId: z.uuid("Bir hekim seçin."),
  date: localDate,
  time: localTime,
  patientName: z.string().trim().min(2, "Hastanın adını ve soyadını yazın.").max(100),
  patientPhone: z
    .string()
    .trim()
    .refine((value) => normalizePhone(value) !== null, "Geçerli bir telefon numarası yazın."),
  notes: z.string().trim().max(500, "Not en fazla 500 karakter olabilir.").optional(),
});
export type CreateAppointmentField = keyof z.input<typeof createAppointmentSchema>;

export const availabilityQuerySchema = z.object({
  serviceId: z.uuid(),
  practitionerId: z.uuid().optional(),
  date: localDate,
});

export const changeStatusSchema = z.object({
  appointmentId: z.uuid(),
  status: z.enum(APPOINTMENT_STATUSES),
});

export const appointmentNotesSchema = z.object({
  appointmentId: z.uuid(),
  notes: z.string().trim().max(500, "Not en fazla 500 karakter olabilir."),
});

/** Query string of the appointments list (/panel/randevular). */
export const appointmentListQuerySchema = z.object({
  donem: z.enum(["bugun", "yarin", "hafta", "gelecek", "gecmis"]).catch("gelecek"),
  durum: z.enum(APPOINTMENT_STATUSES).optional().catch(undefined),
  hekim: z.uuid().optional().catch(undefined),
  kaynak: z.enum(APPOINTMENT_SOURCES).optional().catch(undefined),
  q: z.string().trim().max(60).optional().catch(undefined),
  sayfa: z.coerce.number().int().min(1).max(500).catch(1),
});
export type AppointmentListQuery = z.infer<typeof appointmentListQuerySchema>;

export const PERIOD_LABELS: Record<AppointmentListQuery["donem"], string> = {
  bugun: "Bugün",
  yarin: "Yarın",
  hafta: "Bu hafta",
  gelecek: "Yaklaşan",
  gecmis: "Geçmiş",
};

/** Query string of the calendar (/panel/takvim). */
export const calendarQuerySchema = z.object({
  tarih: localDate.optional().catch(undefined),
  gorunum: z.enum(["gun", "hafta"]).optional().catch(undefined),
  /** A practitioner id, or "tum" to override a personal default filter. */
  hekim: z
    .union([z.uuid(), z.literal("tum")])
    .optional()
    .catch(undefined),
});
