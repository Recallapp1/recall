import "server-only";

import { env } from "@/lib/env";

/**
 * TEST_CALL_FLAG (R2 5e): calls marked as tests are left out of the daily
 * numbers. Unset means every call counts, as today.
 */
export function testCallFlag(): boolean {
  try {
    return env().TEST_CALL_FLAG === true;
  } catch {
    // Without a valid environment (some unit tests) the default applies.
    return false;
  }
}
