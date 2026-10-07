import "server-only";

import { createHash } from "node:crypto";

import { and, eq, gt, lte, sql } from "drizzle-orm";

import type { Executor } from "../db";
import { rateLimits } from "../db/schema";

/**
 * Fixed-window rate limiting in Postgres, shared by every serverless instance.
 * One atomic upsert per hit: the window restarts when it has expired.
 */

export interface RateLimitRule {
  /** Maximum hits inside one window. */
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  resetAt: Date;
}

/** Keys built from personal data (phone, e-mail, IP) are hashed so the table holds none. */
export function hashKey(...parts: string[]): string {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 32);
}

/** Counts a hit and says whether it is still within the limit. */
export async function consumeRateLimit(
  db: Executor,
  key: string,
  rule: RateLimitRule,
  now: Date,
): Promise<RateLimitResult> {
  const resetAt = new Date(now.getTime() + rule.windowMs);
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, resetAt })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.resetAt} <= ${now.toISOString()}::timestamptz then 1 else ${rateLimits.count} + 1 end`,
        resetAt: sql`case when ${rateLimits.resetAt} <= ${now.toISOString()}::timestamptz then ${resetAt.toISOString()}::timestamptz else ${rateLimits.resetAt} end`,
      },
    })
    .returning({ count: rateLimits.count, resetAt: rateLimits.resetAt });
  return { allowed: row.count <= rule.limit, count: row.count, resetAt: row.resetAt };
}

/** True when the key has already used up its window, without counting a hit. */
export async function isRateLimited(
  db: Executor,
  key: string,
  rule: RateLimitRule,
  now: Date,
): Promise<boolean> {
  const [row] = await db
    .select({ count: rateLimits.count })
    .from(rateLimits)
    .where(and(eq(rateLimits.key, key), gt(rateLimits.resetAt, now)));
  return (row?.count ?? 0) >= rule.limit;
}

/** Retention: expired windows carry no information. */
export async function deleteExpiredRateLimits(db: Executor, now: Date): Promise<number> {
  const deleted = await db
    .delete(rateLimits)
    .where(lte(rateLimits.resetAt, now))
    .returning({ key: rateLimits.key });
  return deleted.length;
}
