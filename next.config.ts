import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // forbidden() for permission errors in the panel (src/server/auth/session.ts).
    authInterrupts: true,
  },
};

export default nextConfig;
