import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "taskflow_token";
const AUTH_PAGES = ["/login", "/register"];

/**
 * Cheap first gate: bounce visitors without a session cookie before any page renders.
 * The cookie is only checked for presence here; the API is what actually verifies it,
 * and AuthProvider handles an expired or revoked session on the client.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (!hasSession && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (hasSession && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/register", "/dashboard/:path*", "/projects/:path*", "/tasks/:path*"],
};
