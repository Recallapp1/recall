import type { MetadataRoute } from "next";

import { env } from "@/lib/env";

/** Public pages only. */
const PUBLIC_PATHS = ["/"];

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = new URL(env().APP_URL).origin;
  return PUBLIC_PATHS.map((path) => ({
    url: new URL(path, origin).toString(),
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.5,
  }));
}
