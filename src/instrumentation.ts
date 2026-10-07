import type { Instrumentation } from "next";

/**
 * Error tracking (docs/06-operations/MONITORING.md). Server-side only and off
 * unless SENTRY_DSN is set: nothing is loaded in the browser, so the CSP and
 * the panel stay as they are. Events are scrubbed (src/server/observability/sentry.ts).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.SENTRY_DSN) return;
  const { initSentry } = await import("./server/observability/sentry");
  initSentry(process.env.SENTRY_DSN, process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV);
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.SENTRY_DSN) return;
  const { captureRequestError } = await import("./server/observability/sentry");
  await captureRequestError(error, request, context);
};
