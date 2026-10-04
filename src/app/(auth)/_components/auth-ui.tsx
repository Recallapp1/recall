import { CheckCircle2, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import type { FormState } from "@/lib/contracts/form-state";

export function AuthHeading({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-2">
      <h2 className="text-3xl text-display font-semibold text-heading">{title}</h2>
      {description && <p className="text-sm text-body">{description}</p>}
    </div>
  );
}

/** Form-level result: errors are announced (alert), success politely (status). */
export function FormMessage({ state }: { state: FormState }) {
  if (state.status === "error") {
    return (
      <p
        role="alert"
        className="flex items-start gap-2 rounded-card-sm bg-danger-soft px-4 py-3 text-sm text-danger"
      >
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        {state.message}
      </p>
    );
  }
  if (state.status === "success" && state.message) {
    return (
      <p
        role="status"
        className="flex items-start gap-2 rounded-card-sm bg-success-soft px-4 py-3 text-sm text-success"
      >
        <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" />
        {state.message}
      </p>
    );
  }
  return null;
}
