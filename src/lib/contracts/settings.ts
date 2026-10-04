import { z } from "zod";

import { normalizePhone } from "../phone";

/** Clinic settings forms (F5.3). Shared by the panel forms and server actions. */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `En fazla ${max} karakter.`)
    .transform((value) => value || null);

export const clinicProfileSchema = z.object({
  name: z.string().trim().min(2, "Klinik adını yazın.").max(120),
  address: optionalText(300),
  transferPhoneNumber: z
    .string()
    .trim()
    .refine(
      (value) => !value || normalizePhone(value) !== null,
      "Geçerli bir telefon numarası yazın.",
    )
    .transform((value) => (value ? normalizePhone(value) : null)),
});
export type ClinicProfileField = keyof z.input<typeof clinicProfileSchema>;

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Saat SS:DD biçiminde olmalı.");

export const timeRangeSchema = z
  .object({ weekday: z.number().int().min(1).max(7), startTime: time, endTime: time })
  .refine((range) => range.startTime < range.endTime, {
    message: "Bitiş saati başlangıçtan sonra olmalı.",
    path: ["endTime"],
  });

/** Weekly hours: ranges per weekday must not overlap. */
export const weeklyHoursSchema = z
  .array(timeRangeSchema)
  .max(50)
  .superRefine((ranges, ctx) => {
    for (let weekday = 1; weekday <= 7; weekday++) {
      const day = ranges
        .filter((range) => range.weekday === weekday)
        .toSorted((a, b) => a.startTime.localeCompare(b.startTime));
      for (let i = 1; i < day.length; i++) {
        if (day[i]!.startTime < day[i - 1]!.endTime) {
          ctx.addIssue({ code: "custom", message: "Aynı gündeki saat aralıkları çakışıyor." });
          return;
        }
      }
    }
  });
export type WeeklyHours = z.infer<typeof weeklyHoursSchema>;

export const practitionerSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Hekimin adını yazın.").max(100),
  title: optionalText(30),
  isActive: z.boolean(),
  /** Empty means the practitioner offers every service. */
  serviceIds: z.array(z.uuid()).max(100),
  /** Empty means the practitioner follows the clinic's opening hours. */
  hours: weeklyHoursSchema,
});
export type PractitionerInput = z.infer<typeof practitionerSchema>;

const kurus = z.number().int().min(0).max(100_000_000).nullable();

export const serviceSchema = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(2, "Hizmet adını yazın.").max(100),
    description: optionalText(300),
    aliases: z.array(z.string().trim().min(1).max(40)).max(20),
    durationMinutes: z.number().int().min(5, "En az 5 dakika.").max(480, "En fazla 8 saat."),
    priceMin: kurus,
    priceMax: kurus,
    isActive: z.boolean(),
  })
  .refine((s) => s.priceMin === null || s.priceMax === null || s.priceMin <= s.priceMax, {
    message: "En düşük fiyat en yüksek fiyattan büyük olamaz.",
    path: ["priceMax"],
  });
export type ServiceInput = z.infer<typeof serviceSchema>;

export const assistantSettingsSchema = z.object({
  name: z.string().trim().min(1, "Asistanın adını yazın.").max(40),
  greeting: optionalText(300),
  speakPrices: z.boolean(),
  recordCalls: z.boolean(),
  extraInstructions: optionalText(1000),
  faq: z
    .array(
      z.object({
        q: z.string().trim().min(1, "Soruyu yazın.").max(200),
        a: z.string().trim().min(1, "Cevabı yazın.").max(500),
      }),
    )
    .max(20, "En fazla 20 soru."),
});
export type AssistantSettingsInput = z.infer<typeof assistantSettingsSchema>;

export const bookingRulesSchema = z.object({
  slotIntervalMinutes: z.number().int().min(5).max(120),
  minNoticeMinutes: z.number().int().min(0).max(10_080),
  maxDaysAhead: z.number().int().min(1).max(365),
  cancellationMinNoticeHours: z.number().int().min(0).max(168),
  allowPractitionerChoice: z.boolean(),
  smsConfirmation: z.boolean(),
  smsReminderHoursBefore: z.number().int().min(1).max(168).nullable(),
});
export type BookingRulesInput = z.infer<typeof bookingRulesSchema>;

/** Panel modules a clinic can hide from its team's menu (F3.5). */
export const PANEL_MODULES = ["calls", "callbacks", "patients"] as const;
export type PanelModule = (typeof PANEL_MODULES)[number];
export const PANEL_MODULE_LABELS: Record<PanelModule, string> = {
  calls: "Aramalar",
  callbacks: "Geri aranacaklar",
  patients: "Hastalar",
};

export const panelPreferencesSchema = z.object({
  hiddenModules: z.array(z.enum(PANEL_MODULES)).max(PANEL_MODULES.length),
  defaultCalendarView: z.enum(["gun", "hafta"]),
});
export type PanelPreferencesInput = z.infer<typeof panelPreferencesSchema>;

/** Settings actions return this; the client shows a toast or the first error. */
export type SettingsResult = { ok: true; message: string } | { ok: false; message: string };

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Lütfen alanları kontrol edin.";
}
