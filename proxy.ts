import { NextRequest, NextResponse } from "next/server";

import { nextRequestWithMergedCookieHeader } from "@/lib/auth/neon-dev-request-cookies";
import { auth } from "@/lib/auth/server";

/**
 * Neon Auth middleware — see:
 * https://neon.com/docs/auth/reference/nextjs-server#authmiddleware
 *
 * Next.js 16 uses `proxy.ts` + named export `proxy`.
 */
const neonAuthMiddleware = auth.middleware({
  loginUrl: "/auth/sign-in",
});

function redirectToLocalhostInDev(request: NextRequest): NextResponse | null {
  // Playwright targets 127.0.0.1; keep that host when the E2E auth stub is active.
  if (process.env.E2E_PLAYWRIGHT === "1") return null;
  if (process.env.NODE_ENV !== "development") return null;
  const host = request.headers.get("host") ?? "";
  const lower = host.toLowerCase();
  const isLoopbackIp =
    lower.startsWith("127.0.0.1:") ||
    lower === "127.0.0.1" ||
    lower.startsWith("[::1]:") ||
    lower === "[::1]";
  if (!isLoopbackIp) return null;
  const url = request.nextUrl.clone();
  url.hostname = "localhost";
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  const devLocalhostRedirect = redirectToLocalhostInDev(request);
  if (devLocalhostRedirect) return devLocalhostRedirect;

  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    return NextResponse.next();
  }

  /**
   * Route handlers under `/api/*` must receive the request directly. If Neon
   * `auth.middleware()` redirects unauthenticated users to `/auth/sign-in`, the
   * browser's `fetch()` follows that redirect and ends up with **200 HTML** —
   * JSON.parse then fails with "Unrecognized token '<'".
   *
   * APIs enforce auth themselves (e.g. 401 JSON from `/api/generate-lookbook`).
   */
  if (pathname.startsWith("/api/")) {
    const merged = nextRequestWithMergedCookieHeader(request);
    return NextResponse.next({
      request: { headers: merged.headers },
    });
  }

  const mergedReq = nextRequestWithMergedCookieHeader(request);
  return neonAuthMiddleware(mergedReq);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
