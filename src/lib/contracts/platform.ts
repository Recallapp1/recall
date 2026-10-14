import { z } from "zod";

import { CLINIC_TEMPLATE_KEYS } from "../clinic-templates";
import { normalizePhone } from "../phone";

/** Recall console forms (F6). */

const e164 = z
  .string()
  .trim()
  .refine((value) => normalizePhone(value) !== null, "Geçerli bir telefon numarası yazın.")
  .transform((value) => normalizePhone(value)!);

export const createClinicSchema = z.object({
  name: z.string().trim().min(2, "Klinik adını yazın.").max(120),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Kısa ad yalnızca küçük harf, rakam ve tire içerebilir.")
    .min(3, "Kısa ad en az 3 karakter.")
    .max(48),
  template: z.enum(CLINIC_TEMPLATE_KEYS as [string, ...string[]]),
  ownerName: z.string().trim().min(2, "Klinik sahibinin adını yazın.").max(100),
  ownerEmail: z.string().trim().toLowerCase().pipe(z.email("Geçerli bir e-posta adresi yazın.")),
  phoneNumber: z.union([z.literal(""), e164]).transform((value) => value || null),
});
export type CreateClinicInput = z.output<typeof createClinicSchema>;
export type CreateClinicField = keyof z.input<typeof createClinicSchema>;

export const phoneNumberSchema = z.object({ clinicId: z.uuid(), e164 });

export const DEMO_REQUEST_STATUSES = ["new", "contacted", "won", "lost"] as const;
export const DEMO_REQUEST_STATUS_LABELS: Record<(typeof DEMO_REQUEST_STATUSES)[number], string> = {
  new: "Yeni",
  contacted: "Görüşüldü",
  won: "Müşteri oldu",
  lost: "Olumsuz",
};

/**
 * Abuse and cost limits per clinic (audit P-08), one definition for the
 * stored settings (clinic-settings.ts) and the console form (FA-09).
 */
export const CLINIC_LIMIT_FIELDS = {
  callsPerNumberPerHour: { label: "Bir numaradan saatlik arama", min: 1, max: 100, fallback: 5 },
  callsPerNumberPerDay: { label: "Bir numaradan günlük arama", min: 1, max: 500, fallback: 15 },
  hiddenCallsPerHour: {
    label: "Gizli numaralı aramalar (saatlik)",
    min: 1,
    max: 500,
    fallback: 10,
  },
  callsPerHour: { label: "Kliniğe tüm aramalar (saatlik)", min: 1, max: 1000, fallback: 60 },
  dailyVoiceMinutes: { label: "Günlük ses dakikası", min: 10, max: 10_000, fallback: 300 },
  maxCallMinutes: { label: "Tek arama üst sınırı (dk)", min: 2, max: 30, fallback: 15 },
  bookingsPerCall: { label: "Bir aramada randevu", min: 1, max: 10, fallback: 2 },
  bookingsPerNumberPerDay: {
    label: "Bir numaraya 24 saatte randevu",
    min: 1,
    max: 20,
    fallback: 3,
  },
} as const;

export type ClinicLimitKey = keyof typeof CLINIC_LIMIT_FIELDS;

const limit = (key: ClinicLimitKey) => {
  const { label, min, max, fallback } = CLINIC_LIMIT_FIELDS[key];
  const message = `${label} ${min} ile ${max} arasında bir tam sayı olmalı.`;
  return z
    .number({ error: message })
    .int({ error: message })
    .min(min, { error: message })
    .max(max, { error: message })
    .default(fallback);
};

export const clinicLimitsSchema = z.object({
  callsPerNumberPerHour: limit("callsPerNumberPerHour"),
  callsPerNumberPerDay: limit("callsPerNumberPerDay"),
  hiddenCallsPerHour: limit("hiddenCallsPerHour"),
  callsPerHour: limit("callsPerHour"),
  dailyVoiceMinutes: limit("dailyVoiceMinutes"),
  maxCallMinutes: limit("maxCallMinutes"),
  bookingsPerCall: limit("bookingsPerCall"),
  bookingsPerNumberPerDay: limit("bookingsPerNumberPerDay"),
});
export type ClinicLimits = z.output<typeof clinicLimitsSchema>;

export const clinicLimitsInputSchema = z.object({
  clinicId: z.uuid(),
  limits: clinicLimitsSchema,
});
