import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge must know our custom utilities; otherwise it treats
 * `text-label` as a text colour and silently drops `text-on-dark` next to it.
 */
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
      color: [
        "ink",
        "surface-dark",
        "surface-darker",
        "surface-dark-hover",
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
      ],
      radius: ["section", "bento", "card", "card-sm"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
