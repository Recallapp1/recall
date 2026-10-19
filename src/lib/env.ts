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
  /**
   * "true": hardened prompt (safety first, clinic text as untrusted data,
   * recording objection and backend-failure rules, no example names or
   * numbers) (audit A9). Off everywhere until measured.
   */
  VOICE_PROMPT_HARDENING: optionalFlag,
  /**
   * "true": the emergency rule opens the baseline prompt, with the exact
   * sentence in words and a longer symptom list (the hardened prompt's rule
   * alone). Changes the agent spec; off until a real-call test (C5).
   */
  VOICE_EMERGENCY_FIRST: optionalFlag,
  /**
   * "true": when the call cannot be transferred, the assistant ends it after
   * the emergency sentence so the caller can dial 112, unless the caller is
   * still talking. Changes the agent spec; off until a real-call test.
   */
  VOICE_EMERGENCY_END_CALL: optionalFlag,
  /**
   * "true": A17 with the draft wording: the greeting says "yapay zekâ
   * asistanı" and points to the privacy notice; the prompt answers "are you
   * a person?" honestly and handles an objection to recording. Changes the
   * agent spec; off until the lawyer approves the wording.
   */
  VOICE_KVKK_NOTICE: optionalFlag,
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
   * "true": a call flagged unbacked_claim also e-mails the clinic's owners and
   * admins right away (call time and a panel link, no patient data). Needs
   * POST_CALL_FLAGS. Off by default.
   */
  UNBACKED_CLAIM_EMAIL: optionalFlag,
  /** "true": store the provider's per-call latency (p50/p90/max per component). Off by default. */
  CALL_LATENCY_STORE: optionalFlag,
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
   * "true": a voice tool request that fails before the tool runs (database
   * down) answers ok: false with an honest message instead of HTTP 500
   * (gap review G-03). Off by default.
   */
  VOICE_TOOL_FAILSAFE: optionalFlag,
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
  /**
   * "true": family members sharing a number get their own patient records
   * (P-12), and the call list, search and SMS opt-out follow the number. Off by
   * default; until the unique (clinic_id, phone) index is dropped a second
   * record falls back to the number's existing patient.
   */
  PATIENTS_PER_NAME: optionalFlag,
  /**
   * "true": staff with patients.update can correct a patient's name and phone
   * in the panel (KVKK m.11 correction, gap review G-02). Off by default.
   */
  PANEL_PATIENT_EDIT: optionalFlag,
  /**
   * "true": /api/cron/provider-deletions processes the Retell deletion queue
   * (R2 5a). Needs an hourly cron entry (Vercel Pro); off by default.
   */
  DELETION_QUEUE_HOURLY: optionalFlag,
  /**
   * "true": appointment reminders come from /api/cron/reminders (hourly,
   * honouring smsReminderHoursBefore) instead of the daily job (R2 5b).
   * Needs an hourly cron entry (Vercel Pro); off by default.
   */
  HOURLY_REMINDERS: optionalFlag,
  /** "true": owners and admins see the read-only "Yayına hazırlık" page (R2 5c). Off by default. */
  PANEL_GO_LIVE_CHECK: optionalFlag,
  /**
   * "true": Recall console users edit a clinic's abuse and cost limits on the
   * clinic page; audited (full audit FA-09). Unset: limits change only in the
   * database, as today.
   */
  CONSOLE_LIMITS_EDIT: optionalFlag,
  /**
   * "true": the daily retention job queues the voice provider's copy of
   * recording-off calls whose analysis never arrived (full audit FA-10).
   * Unset: such copies wait for the provider's own 30-day deletion, as today.
   */
  RECORDING_OFF_SWEEP: optionalFlag,
  /**
   * "true": a Recall console user can never join a clinic's team (console,
   * CLI, invitation, or the console role granted to a member). Unset: allowed,
   * and every such join is a critical audit entry (owner's decision 2026-10-14).
   */
  BLOCK_CONSOLE_CLINIC_MEMBERSHIP: optionalFlag,
  /**
   * "true": staff who can read calls report a call as wrong assistant
   * behaviour with a reason from a fixed list; audited (R2 5d). Off by default.
   */
  CALL_REVIEW: optionalFlag,
  /**
   * "true": owners and admins mark a call as a test call; marked calls and
   * their bookings are left out of the "Bugün" numbers (R2 5e). Off by default.
   */
  TEST_CALL_FLAG: optionalFlag,
  /**
   * Two-step sign-in (TOTP) for panel users (docs/proposals/2FA-TOTP).
   * "off" (default, unset): the plugin is not loaded, today's sign-in exactly.
   * "optional": anyone may enrol. "required-admins": owners, admins and Recall
   * platform admins must enrol. "required-all": every member must.
   */
  PANEL_TWO_FACTOR: z.enum(["off", "optional", "required-admins", "required-all"]).default("off"),
  /**
   * Who may reset someone's two-step sign-in from the Recall console: e-mails,
   * comma separated (owner's decision: the Recall owner only). Unset: nobody.
   */
  TWO_FACTOR_RESET_EMAILS: optionalString,
  /**
   * Panel session lifetime in hours, 1–168 (gap review G-05): shorter sessions
   * for reception computers shared between shifts. Unset: 7 days, as today.
   */
  PANEL_SESSION_HOURS: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : undefined))
    .pipe(z.number().int().min(1).max(168).optional()),

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
