import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Verifies the shared secret Vapi sends with every server message, either as
 * `x-vapi-secret` or as a bearer token, in constant time.
 */
export function isAuthorizedVapiRequest(headers: Headers, secret: string): boolean {
  const bearer = headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const provided = headers.get("x-vapi-secret") ?? bearer;
  if (!provided) return false;

  // Hashing equalises lengths so timingSafeEqual never throws or leaks length.
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(provided), digest(secret));
}
