import "server-only";

import { z } from "zod";

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value ? value : undefined));

/** A 0–1 setting that is either set or left to the provider's default. */
const optionalUnit = z
  .string()
  .optional()
  .transform((value) => (value ? Number(value) : undefined))
  .pipe(z.number().min(0).max(1).optional());

/** "true" / "false", or unset to keep the provider's default. */
const optionalFlag = z
  .enum(["true", "false", ""])
  .optional()
  .transform((value) => (value ? value === "true" : undefined));

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
  RETELL_LLM_MODEL: z.string().default("claude-4.5-haiku"),
  /** TTS model for the voice; must belong to the voice's provider (e.g. eleven_multilingual_v2). */
  RETELL_VOICE_MODEL: optionalString,
  /** "true": Retell's high-priority LLM pool (faster, steadier, costs more per minute). */
  RETELL_LLM_HIGH_PRIORITY: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  /**
   * Latency tuning (ADR-003 option A). Each is off or unset by default, which
   * keeps today's assistant exactly; set in Vercel to roll out, unset to roll back.
   * "compact": the shorter system prompt with the same rules.
   */
  VOICE_PROMPT_VARIANT: z.enum(["full", "compact"]).default("full"),
  /** Retell turn-taking, 0–1 (Retell default 1 = answers as soon as it can). Lower waits longer. */
  RETELL_RESPONSIVENESS: optionalUnit,
  /** 0–1 (Retell default 1). Lower needs more words before the caller interrupts the agent. */
  RETELL_INTERRUPTION_SENSITIVITY: optionalUnit,
  /** "true": Retell adapts its answer timing to the caller's speech rate (waits for slow speakers). */
  RETELL_DYNAMIC_RESPONSIVENESS: optionalFlag,
  /**
   * "true": after each call, flag unbacked booking claims and emergency or
   * medical-risk mentions for the panel (audit F-03, F-04). Off by default.
   */
  POST_CALL_FLAGS: optionalFlag,
  /**
   * "true": a number with appointments booked for different people counts as
   * shared; changing or revealing one needs name, date and time even with
   * caller ID (audit A2, F-07). Off by default.
   */
  VOICE_SHARED_NUMBER_CHECK: optionalFlag,
  /**
   * "true": book, cancel, reschedule and callback requests are keyed by call
   * and tool call; a repeat returns the stored first result (audit A3). Off by default.
   */
  VOICE_TOOL_IDEMPOTENCY: optionalFlag,
  /**
   * When set, /api/health/jobs shows job details only with the
   * `x-health-token` header; others get the status alone (audit A6).
   */
  HEALTH_JOBS_TOKEN: optionalString,
  /**
   * "true": audit records of patient data, appointment and settings changes
   * become critical (retry, alarm, the action fails) (audit A7). Off by default.
   */
  AUDIT_STRICT: optionalFlag,
  /** "true": owners and admins see a read-only "Kullanım ve sınırlar" page (audit A8). Off by default. */
  PANEL_LIMITS_VIEW: optionalFlag,

  SMS_PROVIDER: z.enum(["console", "netgsm"]).default("console"),
  /**
   * Master switch for real SMS. Only the exact string "true" enables it; unset
   * (the production default until Netgsm and the İYS review are done) keeps
   * every message on the non-delivering stub, whatever SMS_PROVIDER says.
   */
  SMS_SENDING_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "true"),
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

  /** Recall team inbox told about new demo requests; unset = no e-mail. */
  DEMO_REQUEST_NOTIFY_EMAIL: z
    .email()
    .optional()
    .or(z.literal("").transform(() => undefined)),
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

  // `next dev` reloads .env.local in place (e.g. a new tunnel's APP_URL from
  // `pnpm dev:tunnel`); re-parsing there keeps the server from syncing a stale URL.
  if (result.data.NODE_ENV === "production") cached = result.data;
  return result.data;
}
