import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/** DESIGN.md §1 label: 700 weight, 10px, 0.2em tracking, uppercase. */
export function Eyebrow({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-label", className)} {...props} />;
}

/** Section heading: display tracking and line-height, text-4xl to text-5xl. */
export function DisplayHeading({
  as: Tag = "h2",
  className,
  ...props
}: ComponentProps<"h2"> & { as?: "h1" | "h2" | "h3" }) {
  return (
    <Tag
      className={cn("text-4xl text-display font-semibold text-balance sm:text-5xl", className)}
      {...props}
    />
  );
}

/** Body copy: weight 300–400, Zinc-500 on light surfaces. */
export function BodyText({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("leading-relaxed font-light text-body", className)} {...props} />;
}
