import "server-only";

import { safeError } from "@/lib/safe-error";

import { captureAlarm } from "./sentry";

/**
 * Something the Recall team must look at now. Logged at error level with a
 * fixed `ALARM` marker that error tracking and log alerts match on
 * (docs/06-operations/MONITORING.md). Fields are ids and codes only.
 */
export function raiseAlarm(
  event: string,
  fields: Record<string, string | number | boolean | null> = {},
  error?: unknown,
): void {
  const record = {
    ...fields,
    ...(error === undefined ? {} : { error: safeError(error) }),
  };
  console.error(JSON.stringify({ msg: "ALARM", event, ...record }));
  captureAlarm(event, record);
}
