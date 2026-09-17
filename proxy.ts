import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { AUTH_SIGN_IN_PATH } from "@/lib/auth/config";

const PUBLIC_PATHS = new Set([
  "/",
  AUTH_SIGN_IN_PATH,
  "/auth/sign-in",
  "/auth/sign-out",
  "/auth/not-admitted",
  "/auth/not-admin",
  "/auth/accept-invite",
  "/privacy",
  "/terms",
]);

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname) || pathname.startsWith("/invite/");
}

async function loadSession(request: NextRequest) {
  try {
    return await auth.api.getSession({ headers: request.headers });
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === AUTH_SIGN_IN_PATH || pathname === "/auth/sign-in") {
    const session = await loadSession(request);
    return session
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next();
  }

  if (isPublicPath(pathname)) return NextResponse.next();

  const session = await loadSession(request);
  if (!session) {
    return NextResponse.redirect(new URL(AUTH_SIGN_IN_PATH, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api(?:/|$)|_next(?:/|$)|favicon\\.ico$|.*\\.(?:avif|gif|ico|jpe?g|png|svg|webp)$).*)",
  ],
};
