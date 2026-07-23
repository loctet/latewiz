import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const protectedPrefixes = ["/dashboard", "/onboarding", "/api/vault", "/api/me", "/api/campaigns"];

function isProtectedPath(pathname: string): boolean {
  if (pathname.startsWith("/api/auth")) return false;
  if (pathname.startsWith("/api/cron")) return false;
  if (protectedPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  // AI + zernio proxy require session in multi-user mode
  if (
    pathname.startsWith("/api/ai") ||
    pathname.startsWith("/api/zernio") ||
    pathname.startsWith("/api/validate-key") ||
    pathname.startsWith("/api/media")
  ) {
    return true;
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding",
    "/onboarding/:path*",
    "/api/vault/:path*",
    "/api/me/:path*",
    "/api/campaigns/:path*",
    "/api/ai/:path*",
    "/api/zernio",
    "/api/validate-key",
    "/api/media/:path*",
  ],
};
