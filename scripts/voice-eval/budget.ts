/**
 * Spending guard for the voice evaluation (audit C8): a run stops cleanly
 * before it can overspend or run into an empty credit balance, and the dev
 * assistant is always switched back (run.ts).
 */

/** Whether the next call still fits: what was spent plus a cautious estimate of the next call. */
export function budgetAllows(spentUsd: number, nextCallUsd: number, budgetUsd: number): boolean {
  return spentUsd + nextCallUsd <= budgetUsd;
}

/** Retell answers 402 (or says so) when the workspace has no credit left. */
export function isCreditExhausted(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const status = (error as { status?: unknown }).status;
  const message = String((error as { message?: unknown }).message ?? "");
  return status === 402 || /credit balance|top up/i.test(message);
}

/** A cautious per-call estimate: the measured average with a 50% margin for long calls. */
export function cautiousCallEstimate(averageCallUsd: number): number {
  return averageCallUsd * 1.5;
}
