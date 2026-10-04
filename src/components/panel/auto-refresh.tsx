"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-renders the page's server components every `seconds` while the tab is
 * visible, so bookings made by the assistant appear without a reload (F5.4).
 */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(tick, seconds * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, seconds]);
  return null;
}
