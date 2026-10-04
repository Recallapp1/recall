import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/** Glass panel for dark surfaces (DESIGN.md §1): 5% white, 12px blur, 10% border. */
export function GlassCard({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-card glass p-5 text-on-dark", className)} {...props} />;
}

/** DESIGN.md §5 "Glass Stat Card": large metric with a muted description. */
export function GlassStatCard({
  value,
  description,
  className,
  ...props
}: Omit<ComponentProps<"div">, "children"> & { value: string; description: string }) {
  return (
    <GlassCard className={cn("w-72", className)} {...props}>
      <p className="text-3xl text-display font-semibold">{value}</p>
      <p className="mt-2 text-sm text-on-dark-muted">{description}</p>
    </GlassCard>
  );
}
