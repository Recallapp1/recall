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
  /**
   * Abuse and cost limits for the voice assistant (audit P-08). Set by the
   * Recall team per plan (console or database), never by panel forms.
   */
  limits: z
    .object({
      /** Calls from one caller number to this clinic. */
      callsPerNumberPerHour: z.number().int().min(1).max(100).default(5),
      callsPerNumberPerDay: z.number().int().min(1).max(500).default(15),
      /** Calls with a withheld number share one budget. */
      hiddenCallsPerHour: z.number().int().min(1).max(500).default(10),
      /** All calls to the clinic. */
      callsPerHour: z.number().int().min(1).max(1000).default(60),
      /** Voice minutes per clinic-local day; beyond it calls are declined and the team alerted. */
      dailyVoiceMinutes: z.number().int().min(10).max(10_000).default(300),
      /** Hard stop for a single call (the voice platform ends it). */
      maxCallMinutes: z.number().int().min(2).max(30).default(15),
      /** New appointments one call may create. */
      bookingsPerCall: z.number().int().min(1).max(10).default(2),
      /** New voice appointments for one phone number within 24 hours. */
      bookingsPerNumberPerDay: z.number().int().min(1).max(20).default(3),
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
