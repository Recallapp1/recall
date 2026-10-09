import "server-only";

import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";

import { redact } from "@/lib/redact";

let enabled = false;

/**
 * Sentry for server errors and alarms. KVKK: patient data must never leave in
 * an event, so requests are reduced to method and path (no query, body,
 * cookies or headers), users are dropped, and breadcrumbs (which can carry
 * console output and URLs) are not sent. Messages come from safeError().
 */
export function initSentry(dsn: string, environment: string | undefined): void {
  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: 0,
    maxBreadcrumbs: 0,
    beforeSend: scrubEvent,
  });
  enabled = true;
}

export function scrubEvent<T extends Sentry.ErrorEvent>(event: T): T {
  if (event.request) {
    const path = event.request.url
      ? new URL(event.request.url, "https://x.invalid").pathname
      : undefined;
    event.request = { method: event.request.method, url: path };
  }
  delete event.user;
  delete event.breadcrumbs;
  delete event.extra;
  if (event.contexts) delete event.contexts.request;
  // Error texts can quote input: phones, e-mails and keys are masked (C1).
  if (event.message) event.message = redact(event.message);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = redact(exception.value);
  }
  return event;
}

export async function captureRequestError(
  ...args: Parameters<Instrumentation.onRequestError>
): Promise<void> {
  Sentry.captureRequestError(...args);
}

/** Alarms (src/server/observability/alarm.ts) become Sentry issues when Sentry is on. */
export function captureAlarm(event: string, fields: Record<string, unknown>): void {
  if (!enabled) return;
  // Tags, not `extra` (dropped by scrubEvent): alarm fields are ids and codes only.
  const tags: Record<string, string> = { alarm: event };
  for (const [key, value] of Object.entries(fields)) {
    if (key !== "error" && value !== undefined) tags[key] = String(value).slice(0, 200);
  }
  Sentry.captureMessage(`ALARM ${event}`, { level: "error", tags });
}
