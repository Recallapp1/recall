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
  /**
   * Connection pool size. `pnpm db:local` (PGlite socket server) becomes
   * unstable with concurrent connections and must use 1.
   */
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),

  // Optional so the panel runs without voice; voice code asserts them via retellConfig().
  RETELL_API_KEY: optionalString,
  /** Default voice for clinics that have not picked one (`pnpm voice:voices`). */
  RETELL_VOICE_ID: optionalString,
  /** One of Retell's supported LLM ids; see docs/decisions/ADR-003-llm-model.md. */
  RETELL_LLM_MODEL: z.string().default("claude-5-sonnet"),
  /** TTS model for the voice; must belong to the voice's provider (e.g. eleven_multilingual_v2). */
  RETELL_VOICE_MODEL: optionalString,
  /** "true": Retell's high-priority LLM pool (faster, steadier, costs more per minute). */
  RETELL_LLM_HIGH_PRIORITY: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),

  SMS_PROVIDER: z.enum(["console", "netgsm"]).default("console"),
  NETGSM_USERCODE: optionalString,
  NETGSM_PASSWORD: optionalString,
  NETGSM_HEADER: optionalString,

  /** Signs session cookies and tokens. Required in production (min. 32 chars). */
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  /** Origin of the panel (sign-in, email links). Defaults to APP_URL. */
  BETTER_AUTH_URL: z.url().optional(),

  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  RESEND_API_KEY: optionalString,
  EMAIL_FROM: z.string().default("Recall <bildirim@recall.local>"),

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

  if (result.data.EMAIL_PROVIDER === "resend" && !result.data.RESEND_API_KEY) {
    throw new Error("EMAIL_PROVIDER=resend requires RESEND_API_KEY");
  }
  if (result.data.NODE_ENV === "production" && !result.data.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET is required in production");
  }

  cached = result.data;
  return cached;
}
