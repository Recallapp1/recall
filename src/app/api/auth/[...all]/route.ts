import { auth } from "@/server/auth";
import { recordBlockedAuthRequest } from "@/server/auth/http-surface";

/**
 * Better Auth's public HTTP surface. Every flow in the product (sign-in,
 * passwords, invitations, team and roles) runs through server actions that
 * call `auth().api` directly and enforce our rules: assignable roles, the
 * last owner, custom-role limits and the audit trail. Direct calls to the
 * library's endpoints would skip all of that (and organization deletion
 * locked a clinic out), so only harmless reads stay open
 * (docs/reviews/PRELAUNCH-AUDIT-2026-10-08.md, P-04).
 */
const OPEN_GET_PATHS = new Set(["ok", "get-session"]);

function endpoint(request: Request): string {
  return new URL(request.url).pathname.replace(/^\/api\/auth\/?/, "");
}

export async function GET(request: Request) {
  if (OPEN_GET_PATHS.has(endpoint(request))) return auth().handler(request);
  return recordBlockedAuthRequest(request, endpoint(request));
}

export async function POST(request: Request) {
  return recordBlockedAuthRequest(request, endpoint(request));
}
