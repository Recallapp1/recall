"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toasts (DESIGN-SYSTEM.md §3): navy pill, white text, coloured icon. The panel
 * has no dark mode, so the theme is fixed to light (sonner's own styles).
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
      icons={{
        success: <CircleCheckIcon className="size-4 text-accent" />,
        info: <InfoIcon className="size-4 text-accent" />,
        warning: <TriangleAlertIcon className="size-4 text-accent" />,
        error: <OctagonXIcon className="size-4 text-on-dark" />,
        loading: <Loader2Icon className="size-4 animate-spin text-accent" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "surface-dark flex w-full items-center gap-3 rounded-card border border-glass-border px-4 py-3 text-sm shadow-xl shadow-ink/20",
          title: "font-medium text-on-dark",
          description: "text-on-dark-muted",
          error: "bg-danger bg-none [&_[data-description]]:text-on-dark-soft",
          actionButton:
            "ml-auto rounded-full bg-paper px-3 py-1.5 text-xs font-medium text-heading",
          cancelButton: "rounded-full px-3 py-1.5 text-xs text-on-dark-muted",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
