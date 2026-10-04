import "server-only";

import { z } from "zod";

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value ? value : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url(),
  DATABASE_URL: z.url(),

  VAPI_WEBHOOK_SECRET: z.string().min(16, "VAPI_WEBHOOK_SECRET must be at least 16 characters"),
  VAPI_API_KEY: optionalString,

  VOICE_LLM_MODEL: z.string().default("claude-opus-5-5"),
  VOICE_TRANSCRIBER_PROVIDER: z.string().default("deepgram"),
  VOICE_TRANSCRIBER_MODEL: z.string().default("nova-2"),
  VOICE_TTS_PROVIDER: z.string().default("azure"),
  VOICE_TTS_VOICE_ID: z.string().default("tr-TR-EmelNeural"),

  SMS_PROVIDER: z.enum(["console", "netgsm"]).default("console"),
  NETGSM_USERCODE: optionalString,
  NETGSM_PASSWORD: optionalString,
  NETGSM_HEADER: optionalString,

  CRON_SECRET: optionalString,
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Validated environment. Parsed lazily so `next build` can run without
 * runtime secrets; the first request that needs them fails loudly instead.
 */
export function env(): Env {
  if (cached) return cached;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }

  if (result.data.SMS_PROVIDER === "netgsm") {
    const missing = (["NETGSM_USERCODE", "NETGSM_PASSWORD", "NETGSM_HEADER"] as const).filter(
      (key) => !result.data[key],
    );
    if (missing.length > 0) {
      throw new Error(`SMS_PROVIDER=netgsm requires: ${missing.join(", ")}`);
    }
  }

  cached = result.data;
  return cached;
}
