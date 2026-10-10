import "server-only";

import { env } from "@/lib/env";

/**
 * PATIENTS_PER_NAME (P-12, step 1): family members sharing one phone number
 * get their own patient records once the database allows it. Unset means
 * today's behaviour: one patient per number. Functions take the value as a
 * parameter defaulting to this, so tests can pin it.
 */
export function patientsPerName(): boolean {
  try {
    return env().PATIENTS_PER_NAME === true;
  } catch {
    // Without a valid environment (some unit tests) the default applies.
    return false;
  }
}
