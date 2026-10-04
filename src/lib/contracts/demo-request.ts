import { z } from "zod";

/**
 * Demo request from the landing page. Shared by the form (client) and the
 * server action, so validation messages are identical on both sides.
 */
export const CLINIC_TYPES = [
  "Diş kliniği",
  "Estetik ve güzellik",
  "Fizyoterapi",
  "Poliklinik / muayenehane",
  "Psikolojik danışmanlık",
  "Veteriner kliniği",
  "Diğer",
] as const;

export const demoRequestSchema = z.object({
  fullName: z.string().trim().min(2, "Adınızı ve soyadınızı yazın.").max(100),
  clinicName: z.string().trim().min(2, "Klinik adını yazın.").max(120),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d\s()-]{10,20}$/, "Geçerli bir telefon numarası yazın."),
  email: z
    .union([z.literal(""), z.email("Geçerli bir e-posta adresi yazın.")])
    .transform((value) => value || undefined),
  clinicType: z.enum(CLINIC_TYPES, { error: "Klinik türünü seçin." }),
  message: z
    .string()
    .trim()
    .max(1000, "Mesaj en fazla 1000 karakter olabilir.")
    .transform((value) => value || undefined),
  consent: z.literal("on", { error: "Devam etmek için onay vermeniz gerekiyor." }),
});

export type DemoRequestInput = z.output<typeof demoRequestSchema>;
export type DemoRequestField = keyof z.input<typeof demoRequestSchema>;

export type DemoRequestState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string; fieldErrors?: Partial<Record<DemoRequestField, string>> };
