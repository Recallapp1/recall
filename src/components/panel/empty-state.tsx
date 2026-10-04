import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** DESIGN-SYSTEM.md §3: icon in a primary-soft circle, short text, one action. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-card border border-dashed border-hairline bg-paper px-6 py-12 text-center",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <p className="font-semibold text-heading">{title}</p>
        {description && <p className="text-sm text-body">{description}</p>}
      </div>
      {action}
    </div>
  );
}
