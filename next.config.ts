import type { NextConfig } from "next";

// Read raw here: next.config runs before the app and its env() validation.
const appHost = process.env.APP_URL ? new URL(process.env.APP_URL).host : null;

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The panel's browser test call needs the microphone on our own origin only.
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  experimental: {
    // forbidden() for permission errors in the panel (src/server/auth/session.ts).
    authInterrupts: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    // One canonical host: www.<domain> → <domain>.
    if (!appHost || appHost.startsWith("www.") || appHost.startsWith("localhost")) return [];
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: `www.${appHost}` }],
        destination: `https://${appHost}/:path*`,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
