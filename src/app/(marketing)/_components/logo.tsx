import { AudioLines } from "lucide-react";

import { cn } from "@/lib/cn";

/** Interim wordmark until the brand logo is designed (see DESIGN-SYSTEM.md §6). */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold text-on-dark", className)}>
      <span className="flex size-8 items-center justify-center rounded-full bg-primary">
        <AudioLines aria-hidden className="size-4 text-on-dark" />
      </span>
      <span className="text-lg tracking-tight">Recall</span>
    </span>
  );
}
