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

  // Optional so the panel runs without voice; voice code asserts them via retellConfig().
  RETELL_API_KEY: optionalString,
  /** Default voice for clinics that have not picked one (`pnpm voice:voices`). */
  RETELL_VOICE_ID: optionalString,
  /** One of Retell's supported LLM ids; see docs/decisions/ADR-003-llm-model.md. */
  RETELL_LLM_MODEL: z.string().default("claude-5-sonnet"),

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
