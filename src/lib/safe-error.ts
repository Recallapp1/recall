/**
 * Error details that are safe to log. Drizzle puts query parameters (names,
 * phone numbers) into its error messages; logging those would leak personal
 * and health data (docs/05-compliance/SECURITY.md). Only the error name, the
 * database error code and the innermost driver message are kept.
 */
export interface SafeError {
  name: string;
  code?: string;
  message: string;
}

const PARAMS_MARKER = /\nparams:[\s\S]*$/;

export function safeError(error: unknown): SafeError {
  if (!(error instanceof Error)) return { name: "UnknownError", message: "non-error thrown" };

  let innermost: Error = error;
  let code: string | undefined;
  for (let current: unknown = error; current instanceof Error; current = current.cause) {
    innermost = current;
    const candidate = (current as { code?: unknown }).code;
    if (typeof candidate === "string") code = candidate;
  }

  // A wrapper without a cause still carries the parameters in its own message.
  const message =
    innermost === error && error.message.startsWith("Failed query")
      ? "Failed query"
      : innermost.message.replace(PARAMS_MARKER, "");

  return { name: error.name, ...(code && { code }), message: message.slice(0, 300) };
}
