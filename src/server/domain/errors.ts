/**
 * Expected business failures. Tools translate these into `{ ok: false }`
 * results the assistant can explain to the caller; anything else is a bug.
 */
export type DomainErrorCode =
  | "CLINIC_NOT_FOUND"
  | "CLINIC_PAUSED"
  | "INVALID_SERVICE"
  | "INVALID_PRACTITIONER"
  | "INVALID_DATE"
  | "OUTSIDE_BOOKING_WINDOW"
  | "SLOT_UNAVAILABLE"
  | "PATIENT_BUSY"
  | "FOLLOW_UP_EXISTS"
  | "PHONE_REQUIRED"
  | "INVALID_PHONE"
  | "INVALID_VOICE"
  | "NOT_FOUND"
  | "TOO_LATE_TO_CANCEL"
  | "INVITATION_INVALID"
  | "ACCOUNT_EXISTS"
  | "INVALID_TRANSITION"
  | "LAST_OWNER"
  | "SLUG_TAKEN"
  | "PHONE_TAKEN"
  | "VERIFICATION_REQUIRED"
  | "VERIFICATION_FAILED"
  | "TOO_MANY_ATTEMPTS"
  | "RATE_LIMITED";

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    /** Plain Turkish explanation the assistant may relay to the caller. */
    readonly userMessage: string,
  ) {
    super(`${code}: ${userMessage}`);
    this.name = "DomainError";
  }
}

/** PostgreSQL exclusion_violation, raised by the appointment overlap constraint. */
export function isOverlapViolation(error: unknown): boolean {
  return pgErrorCode(error) === "23P01";
}

function pgErrorCode(error: unknown): string | undefined {
  // Drizzle wraps driver errors; the pg error may sit on `cause`.
  for (let current = error; current && typeof current === "object";) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}
