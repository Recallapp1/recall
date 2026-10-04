import { ArrowUpRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/**
 * DESIGN.md §5 "Interactive Action Button": pill with a nested circular icon;
 * the whole button scales to 105% on hover.
 * - `onDark`: white pill for navy sections.
 * - `primary`: blue pill for light sections.
 */
export type ActionVariant = "onDark" | "primary";

const base =
  "group inline-flex items-center justify-between gap-4 rounded-full py-2 pr-2 pl-6 font-medium transition-[transform,background-color] duration-300 hover:scale-105 disabled:pointer-events-none disabled:opacity-50";

const variants: Record<ActionVariant, { button: string; icon: string }> = {
  onDark: {
    button: "bg-paper text-heading",
    icon: "bg-surface-dark text-on-dark group-hover:bg-primary",
  },
  primary: {
    button: "bg-primary text-on-dark hover:bg-primary-hover",
    icon: "bg-glass-strong text-on-dark group-hover:bg-surface-dark",
  },
};

function Icon({
  icon: IconComponent = ArrowUpRight,
  className,
}: {
  icon?: LucideIcon;
  className: string;
}) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full transition-colors duration-300",
        className,
      )}
    >
      <IconComponent aria-hidden className="size-4" />
    </span>
  );
}

type Shared = { icon?: LucideIcon; variant?: ActionVariant };

export function ActionButton({
  className,
  children,
  icon,
  variant = "onDark",
  type = "button",
  ...props
}: ComponentProps<"button"> & Shared) {
  return (
    <button type={type} className={cn(base, variants[variant].button, className)} {...props}>
      {children}
      <Icon icon={icon} className={variants[variant].icon} />
    </button>
  );
}

export function ActionLink({
  className,
  children,
  icon,
  variant = "onDark",
  ...props
}: ComponentProps<typeof Link> & Shared) {
  return (
    <Link className={cn(base, variants[variant].button, className)} {...props}>
      {children}
      <Icon icon={icon} className={variants[variant].icon} />
    </Link>
  );
}

/** Secondary pill: outlined, for the less important of two actions. */
export function SecondaryLink({
  className,
  tone = "onDark",
  ...props
}: ComponentProps<typeof Link> & { tone?: "onDark" | "onLight" }) {
  return (
    <Link
      className={cn(
        "inline-flex items-center justify-center rounded-full px-6 py-3.5 font-medium transition-colors duration-300",
        tone === "onDark"
          ? "border border-glass-border text-on-dark hover:bg-glass-strong"
          : "border border-hairline bg-paper text-heading hover:border-primary hover:text-primary",
        className,
      )}
      {...props}
    />
  );
}
