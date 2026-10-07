import { auth } from "@/server/auth";
import { allow, clientIp, TOO_MANY_ATTEMPTS } from "@/server/security/rate-limits";

/**
 * Our forms call Better Auth through server actions (with their own limits).
 * These public endpoints stay reachable, so credential and e-mail endpoints
 * share a per-address limit here; Better Auth's own limiter is per instance.
 */
const SENSITIVE = /\/(sign-in|sign-up|request-password-reset|forget-password|reset-password)(\/|$)/;

export function GET(request: Request) {
  return auth().handler(request);
}

export async function POST(request: Request) {
  if (SENSITIVE.test(new URL(request.url).pathname)) {
    if (!(await allow("authHttpIp", [clientIp(request.headers)]))) {
      return Response.json({ code: "RATE_LIMITED", message: TOO_MANY_ATTEMPTS }, { status: 429 });
    }
  }
  return auth().handler(request);
}
