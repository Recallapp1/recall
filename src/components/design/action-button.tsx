import { ArrowUpRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/**
 * DESIGN.md §5 "Interactive Action Button": white pill with a nested circular
 * icon; the whole button scales to 105% on hover and the icon darkens.
 */
const base =
  "group inline-flex items-center gap-4 rounded-full bg-paper py-2 pr-2 pl-6 font-medium text-heading transition-[transform,background-color] duration-300 hover:scale-105 disabled:pointer-events-none disabled:opacity-50";

function Icon({ icon: IconComponent = ArrowUpRight }: { icon?: LucideIcon }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-dark text-on-dark transition-colors duration-300 group-hover:bg-surface-dark-hover">
      <IconComponent aria-hidden className="size-4" />
    </span>
  );
}

type ButtonProps = ComponentProps<"button"> & { icon?: LucideIcon };

export function ActionButton({
  className,
  children,
  icon,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={cn(base, className)} {...props}>
      {children}
      <Icon icon={icon} />
    </button>
  );
}

type LinkProps = ComponentProps<typeof Link> & { icon?: LucideIcon };

export function ActionLink({ className, children, icon, ...props }: LinkProps) {
  return (
    <Link className={cn(base, className)} {...props}>
      {children}
      <Icon icon={icon} />
    </Link>
  );
}
