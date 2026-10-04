import * as React from "react";

import { cn } from "@/lib/cn";

/** Shared field look (DESIGN-SYSTEM.md §3 "Form alanı"): same as the demo form. */
export const fieldClassName =
  "w-full min-w-0 rounded-card-sm border border-hairline bg-paper px-4 text-sm text-heading transition-colors outline-none placeholder:text-body/70 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-canvas disabled:opacity-60 aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger/15";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldClassName,
        "h-11 py-2 file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-heading",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
