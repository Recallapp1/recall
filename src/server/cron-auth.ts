import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Returns the error
 * response to send, or null when the request may run the job. Without a
 * configured secret no job runs (503), so a missing env var fails closed.
 */
export function rejectUnauthorizedCron(
  request: Request,
  secret: string | undefined,
  job: string,
): Response | null {
  if (!secret) {
    console.error(JSON.stringify({ msg: "cron.not_configured", job }));
    return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  }
  const header = request.headers.get("authorization") ?? "";
  if (!secretMatches(header, `Bearer ${secret}`)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** Constant-time comparison: both sides are hashed, so lengths do not leak. */
export function secretMatches(given: string, expected: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}
