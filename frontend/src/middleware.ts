import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "taskflow_token";

/**
 * Cheap first gate: bounce visitors without a session cookie before any private page renders.
 * The cookie is only checked for presence here; the API is what actually verifies it.
 * Auth pages are deliberately not redirected away from: a stale cookie would otherwise
 * loop between /login (client sees 401) and /dashboard (middleware sees a cookie).
 * Signed-in users are redirected off those pages on the client instead.
 */
export function middleware(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/projects/:path*", "/tasks/:path*"],
};
