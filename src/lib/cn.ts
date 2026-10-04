import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge must know our custom utilities; otherwise it treats
 * `text-label` as a text colour and silently drops `text-on-dark` next to it.
 */
/** Colour tokens from globals.css `@theme` (kept in sync by cn.test.ts). */
export const DESIGN_COLORS = [
  "ink",
  "surface-dark",
  "surface-darker",
  "surface-dark-hover",
  "surface-raised",
  "primary",
  "primary-hover",
  "primary-soft",
  "success",
  "success-soft",
  "danger",
  "danger-hover",
  "danger-soft",
  "canvas",
  "paper",
  "accent",
  "body",
  "heading",
  "hairline",
  "glass",
  "glass-strong",
  "glass-border",
  "on-dark",
  "on-dark-muted",
  "on-dark-soft",
] as const;

type CustomGroups = "text-display" | "text-label" | "glass" | "dark-surface" | "grain";

const twMerge = extendTailwindMerge<CustomGroups>({
  extend: {
    classGroups: {
      "text-display": ["text-display"],
      "text-label": ["text-label"],
      glass: ["glass", "glass-nav"],
      "dark-surface": ["surface-dark", "bg-dark-gradient"],
      grain: ["grain"],
    },
    theme: {
      color: [...DESIGN_COLORS],
      radius: ["section", "bento", "card", "card-sm"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
