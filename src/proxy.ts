import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate for the panel: no session cookie → sign-in page. The cookie
 * is not validated here; requireSession()/requireClinic() do that on the
 * server for every page and action (defence in depth, F3.2).
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  const signIn = new URL("/giris", request.url);
  signIn.searchParams.set("sonra", request.nextUrl.pathname);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: ["/panel/:path*"],
};
