import { z } from "zod";

/** Correcting a patient's identity in the panel (KVKK m.11, gap review G-02). */
export const patientIdentitySchema = z.object({
  patientId: z.uuid(),
  fullName: z
    .string()
    .trim()
    .min(2, "Ad soyad en az 2 karakter olmalı.")
    .max(100, "Ad soyad en fazla 100 karakter olabilir."),
  phone: z.string().trim().min(1, "Telefon numarasını girin.").max(30),
});

export type PatientIdentityInput = z.infer<typeof patientIdentitySchema>;
export type PatientIdentityField = "fullName" | "phone";
