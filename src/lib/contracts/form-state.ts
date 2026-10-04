import type { z } from "zod";

/** Result of a form server action, rendered with useActionState. */
export type FormState<Field extends string = string> =
  | { status: "idle" }
  | { status: "success"; message?: string }
  | { status: "error"; message: string; fieldErrors?: Partial<Record<Field, string>> };

/** First Zod message per field, for inline errors. */
export function fieldErrors<Field extends string>(
  error: z.ZodError,
): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "") as Field;
    errors[field] ??= issue.message;
  }
  return errors;
}
