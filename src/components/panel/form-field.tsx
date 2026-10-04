import { cloneElement, useId, type ReactElement } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

interface ControlProps {
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/**
 * Label + control + hint/error, wired for screen readers (DESIGN-SYSTEM.md §4):
 * the error is linked with aria-describedby and marks the control invalid.
 * Pass the control directly, or a function when the focusable element is
 * nested (e.g. `{(field) => <Select><SelectTrigger {...field} />…</Select>}`).
 */
export function FormField({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactElement<ControlProps> | ((field: ControlProps) => ReactElement);
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint && !error && hintId, error && errorId].filter(Boolean).join(" ") || undefined;

  const field: ControlProps = {
    id,
    "aria-invalid": Boolean(error) || undefined,
    "aria-describedby": describedBy,
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {typeof children === "function" ? children(field) : cloneElement(children, field)}
      {hint && !error && (
        <p id={hintId} className="text-xs text-body">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
