"use client";

import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Vertical point (px from the top) at which the header floats. */
const PROBE_Y = 36;
/** Horizontal sample points across the header, as fractions of the viewport width. */
const PROBE_XS = [0.15, 0.5, 0.85];

type Tone = "dark" | "light";

/**
 * Tone of the surface under a point: the nearest ancestor tagged with
 * `data-header-tone` wins, untagged surfaces count as light. The header itself
 * is skipped so it never measures its own background.
 */
function toneAt(x: number, y: number, header: Element | null): Tone {
  for (const element of document.elementsFromPoint(x, y)) {
    if (header?.contains(element)) continue;
    const tagged = element.closest<HTMLElement>("[data-header-tone]");
    return tagged?.dataset.headerTone === "dark" ? "dark" : "light";
  }
  return "light";
}

/**
 * Translucent header that adapts to what is beneath it. Clear glass with white
 * text vanishes over white surfaces, so if any part of the header sits over a
 * light surface it switches to frosted white with dark text (readable on both).
 * Dark sections, and dark cards inside light sections, opt in with
 * `data-header-tone="dark"`; light cards inside dark sections use "light".
 * Children style themselves with `group-data-[tone=light]/nav:` variants.
 */
export function HeaderSurface({ children }: { children: ReactNode }) {
  const [tone, setTone] = useState<Tone>("dark");

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const header = document.querySelector("header");
        const tones = PROBE_XS.map((fraction) =>
          toneAt(window.innerWidth * fraction, PROBE_Y, header),
        );
        setTone(tones.includes("light") ? "light" : "dark");
      });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <nav
      aria-label="Ana menü"
      data-tone={tone}
      className={cn(
        "group/nav mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full border py-2 pr-2 pl-4 backdrop-blur-[20px] transition-[background-color,border-color,box-shadow] duration-300",
        tone === "dark"
          ? "border-glass-border bg-glass shadow-lg shadow-ink/20"
          : "border-hairline bg-paper/55 shadow-lg shadow-ink/5",
      )}
    >
      {children}
    </nav>
  );
}
