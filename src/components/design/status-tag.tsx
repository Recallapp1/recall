import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/** DESIGN.md §2 status tag: glass pill with an accent dot and a gentle bounce. */
export function StatusTag({ className, children, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex animate-status-bounce items-center gap-2 rounded-full glass px-3 py-1.5 text-xs font-medium text-on-dark",
        className,
      )}
      {...props}
    >
      <span aria-hidden className="size-2 rounded-full bg-accent" />
      {children}
    </span>
  );
}
