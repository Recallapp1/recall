import "server-only";

import type { Executor } from "../db";
import { callPatients } from "../db/schema";

/**
 * Records that a call was about these patients (audit P-09), so erasure can
 * find the call even when it came from a withheld or another person's number.
 */
export async function linkCallToPatients(
  exec: Executor,
  clinicId: string,
  callId: string | null | undefined,
  patientIds: readonly string[],
): Promise<void> {
  if (!callId || patientIds.length === 0) return;
  await exec
    .insert(callPatients)
    .values([...new Set(patientIds)].map((patientId) => ({ clinicId, callId, patientId })))
    .onConflictDoNothing();
}
