import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/**
 * Major section wrapper: always the 2.5rem radius (DESIGN.md §6). Dark
 * sections get the bottom-heavy gradient and grain, never a flat colour.
 */
export function SectionShell({
  tone = "light",
  className,
  ...props
}: ComponentProps<"section"> & { tone?: "dark" | "light" | "paper" }) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-section",
        tone === "dark" && "surface-dark",
        tone === "light" && "bg-canvas text-heading",
        tone === "paper" && "bg-paper text-heading",
        className,
      )}
      {...props}
    />
  );
}

/** Page container: max 1600px, centered (DESIGN.md §3). */
export function PageContainer({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-page px-4 sm:px-6", className)} {...props} />;
}

/** Entry animation (DESIGN.md §2); `delay` staggers siblings. */
export function FadeInUp({
  delay = 0,
  className,
  style,
  ...props
}: ComponentProps<"div"> & { delay?: number }) {
  return (
    <div
      className={cn("animate-fade-in-up", className)}
      style={{ animationDelay: `${delay}ms`, ...style }}
      {...props}
    />
  );
}
