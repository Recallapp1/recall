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
