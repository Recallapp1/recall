import "server-only";

import { headers } from "next/headers";

import { safeError } from "@/lib/safe-error";

import { db, type Executor } from "../db";
import { consumeRateLimit, hashKey, type RateLimitRule } from "../domain/rate-limit";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Every limit in one place (docs/HARDENING-2026-10.md). Counters live in
 * Postgres (`rate_limits`) so all serverless instances share them; subjects
 * (IP, e-mail, phone, ids) are hashed into the key, never stored in clear.
 */
export const LIMITS = {
  /** Sign-in attempts: per network address and per account. */
  signInIp: { limit: 20, windowMs: 10 * MINUTE },
  signInEmail: { limit: 10, windowMs: 15 * MINUTE },
  /** Password e-mails cost money and can be used to spam an address. */
  passwordResetIp: { limit: 10, windowMs: HOUR },
  passwordResetEmail: { limit: 3, windowMs: HOUR },
  /** Token guessing on the set-password and invitation forms. */
  setPasswordIp: { limit: 10, windowMs: HOUR },
  invitationIp: { limit: 10, windowMs: HOUR },
  /** Direct calls to Better Auth's public endpoints (our UI uses server actions). */
  authHttpIp: { limit: 30, windowMs: 10 * MINUTE },
  /** Public landing form. */
  demoRequestIp: { limit: 5, windowMs: HOUR },
  /** Browser test calls are billed by the voice platform. */
  testCallUser: { limit: 10, windowMs: HOUR },
  testCallClinic: { limit: 30, windowMs: DAY },
  /** A runaway assistant loop inside one call. */
  voiceToolsPerCall: { limit: 60, windowMs: HOUR },
  /** Callback notes: per call and per number, so the list cannot be flooded. */
  callbackPerCall: { limit: 3, windowMs: HOUR },
  callbackPerNumber: { limit: 5, windowMs: DAY },
} as const satisfies Record<string, RateLimitRule>;

export type LimitName = keyof typeof LIMITS;

/**
 * Counts one hit and says whether it is allowed. If the counter itself cannot
 * be reached the request is allowed and the failure logged: a database outage
 * already blocks the action, and a limiter must not lock everyone out.
 */
export async function allow(
  name: LimitName,
  subject: readonly string[],
  options: { now?: Date; exec?: Executor } = {},
): Promise<boolean> {
  try {
    const result = await consumeRateLimit(
      options.exec ?? db(),
      limitKey(name, subject),
      LIMITS[name],
      options.now ?? new Date(),
    );
    if (!result.allowed) console.warn(JSON.stringify({ msg: "rate_limit.blocked", limit: name }));
    return result.allowed;
  } catch (error) {
    console.error(
      JSON.stringify({ msg: "rate_limit.failed", limit: name, error: safeError(error) }),
    );
    return true;
  }
}

export function limitKey(name: LimitName, subject: readonly string[]): string {
  return `${name}:${hashKey(...subject.map((part) => part.trim().toLowerCase()))}`;
}

/**
 * The caller's address. On Vercel the platform sets `x-real-ip` and the first
 * `x-forwarded-for` entry; a client cannot override what the edge writes.
 */
export function clientIp(source: Headers): string {
  return (
    source.get("x-real-ip")?.trim() ||
    source.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/** For server actions, which read headers from the request scope. */
export async function requestIp(): Promise<string> {
  return clientIp(await headers());
}

export const TOO_MANY_ATTEMPTS = "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.";
