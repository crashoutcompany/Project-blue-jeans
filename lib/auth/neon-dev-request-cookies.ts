import { NextRequest } from "next/server";

const DEV = process.env.NODE_ENV === "development";

const WIRE_PREFIX = "__Secure-neon-auth.";
const DEV_PREFIX = "neon-auth.";

/**
 * Dev-only: the browser may store `neon-auth.*` (non-Secure) while Neon expects
 * `__Secure-neon-auth.*` on the wire Cookie header. This only rewrites the
 * **incoming** header string — it does not wrap or replace `NextResponse` / Flight.
 */
export function wireNeonCookieHeaderForUpstream(cookieHeader: string): string {
  if (!DEV || !cookieHeader) return cookieHeader;
  return cookieHeader
    .split("; ")
    .map((pair) => {
      const i = pair.indexOf("=");
      if (i === -1) return pair;
      const name = pair.slice(0, i);
      const value = pair.slice(i + 1);
      if (name.startsWith(DEV_PREFIX)) {
        return `${WIRE_PREFIX}${name.slice(DEV_PREFIX.length)}=${value}`;
      }
      return pair;
    })
    .join("; ");
}

/** Merge `NextRequest.cookies` into the `Cookie` header (proxy), with optional dev wiring. */
export function nextRequestWithMergedCookieHeader(
  request: NextRequest,
): NextRequest {
  let cookieHeader = request.headers.get("cookie");
  if (!cookieHeader?.trim()) {
    const jar = request.cookies.getAll();
    if (jar.length === 0) return request;
    cookieHeader = jar.map((c) => `${c.name}=${c.value}`).join("; ");
  }
  if (DEV) {
    cookieHeader = wireNeonCookieHeaderForUpstream(cookieHeader);
  }
  const headers = new Headers(request.headers);
  headers.set("cookie", cookieHeader);
  return new NextRequest(request.url, { headers, method: request.method });
}

/** Forward `Request` to Neon `auth.handler()` with dev cookie names wired on the header. */
export function requestWithNeonDevCookies(request: Request): Request {
  if (!DEV) return request;
  const raw = request.headers.get("cookie");
  if (!raw?.includes(DEV_PREFIX)) return request;
  const h = new Headers(request.headers);
  h.set("cookie", wireNeonCookieHeaderForUpstream(raw));
  return new Request(request.url, {
    method: request.method,
    headers: h,
    body: request.method !== "GET" && request.method !== "HEAD"
      ? request.body
      : undefined,
    duplex: request.body ? "half" : undefined,
  } as RequestInit);
}
