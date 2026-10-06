import { z } from "zod";

import { PANEL_MODULES } from "../../lib/contracts/settings";

/**
 * Behavioural settings stored in `clinics.settings`.
 * Every field has a default so `{}` is a valid configuration and adding
 * fields stays backwards compatible. See docs/02-voice-agent/CLINIC-CONFIG-SCHEMA.md.
 */
export const clinicSettingsSchema = z.object({
  assistant: z
    .object({
      name: z.string().min(1).max(40).default("Asistan"),
      greeting: z.string().max(300).optional(),
      voiceId: z.string().optional(),
      speakPrices: z.boolean().default(false),
      recordCalls: z.boolean().default(true),
      extraInstructions: z.string().max(1000).optional(),
      faq: z
        .array(z.object({ q: z.string().min(1).max(200), a: z.string().min(1).max(500) }))
        .max(20)
        .default([]),
    })
    .prefault({}),
  booking: z
    .object({
      slotIntervalMinutes: z.number().int().min(5).max(120).default(15),
      minNoticeMinutes: z.number().int().min(0).default(60),
      maxDaysAhead: z.number().int().min(1).max(365).default(30),
      cancellationMinNoticeHours: z.number().int().min(0).default(0),
      allowPractitionerChoice: z.boolean().default(true),
    })
    .prefault({}),
  notifications: z
    .object({
      smsConfirmation: z.boolean().default(true),
      smsReminderHoursBefore: z.number().int().min(1).max(168).nullable().default(24),
    })
    .prefault({}),
  /** Modules the Recall team turns on per clinic (console only; never panel forms). */
  features: z
    .object({
      followUp: z.boolean().default(false),
    })
    .prefault({}),
  /** Takip settings (docs/proposals/TAKIP.md); used only when features.followUp is on. */
  followUp: z
    .object({
      /** Clinic-level switch for follow-up SMS; real sending also needs the global locks. */
      smsReminders: z.boolean().default(false),
      /** "Zamanı geldi" window: due within this many days. */
      dueSoonDays: z.number().int().min(1).max(60).default(14),
    })
    .prefault({}),
  /** Clinic-wide panel preferences (F3.5); permissions still apply on top. */
  panel: z
    .object({
      hiddenModules: z.array(z.enum(PANEL_MODULES)).default([]),
      defaultCalendarView: z.enum(["gun", "hafta"]).default("gun"),
    })
    .prefault({}),
});

export type ClinicSettings = z.infer<typeof clinicSettingsSchema>;
export type ClinicSettingsInput = z.input<typeof clinicSettingsSchema>;

export function parseClinicSettings(raw: unknown): ClinicSettings {
  return clinicSettingsSchema.parse(raw ?? {});
}
