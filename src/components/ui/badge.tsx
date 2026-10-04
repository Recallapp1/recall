import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/cn";

/**
 * Pill badge. Colour never carries meaning alone: every badge has text
 * (DESIGN-SYSTEM.md §3). Domain badges (appointment status, source) live in
 * src/components/panel/status-badges.tsx.
 */
const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border border-transparent px-2.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-primary/25 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-on-dark [a]:hover:bg-primary-hover",
        soft: "bg-primary-soft text-primary",
        secondary: "bg-canvas text-body",
        outline: "border-hairline bg-paper text-heading",
        dashed: "border-dashed border-body/50 bg-paper text-body",
        success: "bg-success-soft text-success",
        destructive: "bg-danger-soft text-danger",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
