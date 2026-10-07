/**
 * Content-Security-Policy (docs/HARDENING-2026-10.md). Without nonces: nonces
 * force every page, the public site included, into dynamic rendering, and we
 * load no third-party scripts, so inline scripts stay allowed while every
 * other source is pinned. Hosts beyond our own:
 * - Retell web call (panel test call): API and LiveKit media signalling.
 * - Call recordings (Retell, signed CloudFront links) and voice previews (S3).
 */
export const CSP_SOURCES = {
  connect: [
    "https://api.retellai.com",
    "https://*.retellai.com",
    "wss://*.retellai.com",
    "https://*.livekit.cloud",
    "wss://*.livekit.cloud",
  ],
  media: ["https://*.cloudfront.net", "https://retell-utils-public.s3.us-west-2.amazonaws.com"],
} as const;

export function contentSecurityPolicy({
  dev = false,
  extraScriptSrc = [],
}: { dev?: boolean; extraScriptSrc?: string[] } = {}): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...(dev ? ["'unsafe-eval'"] : []),
      ...extraScriptSrc,
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...CSP_SOURCES.connect, ...(dev ? ["ws:"] : [])],
    "media-src": ["'self'", "blob:", ...CSP_SOURCES.media],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (!dev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}
