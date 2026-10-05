import type { MetadataRoute } from "next";

import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const origin = new URL(env().APP_URL).origin;
  return {
    // The panel, console and webhooks are private; only the public site is indexed.
    rules: [{ userAgent: "*", allow: "/", disallow: ["/panel", "/admin", "/api", "/dev"] }],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
