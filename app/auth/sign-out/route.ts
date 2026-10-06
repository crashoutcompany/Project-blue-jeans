import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

/** Signing out changes state, so a cross-site link or image must not trigger it. */
export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}

export async function POST(request: Request) {
  const signOutResponse = await auth.api.signOut({
    headers: request.headers,
    asResponse: true,
  });
  // 303 so the browser follows the redirect with GET.
  const response = NextResponse.redirect(new URL("/signin", request.url), 303);
  const setCookie = signOutResponse.headers.get("set-cookie");
  if (setCookie) response.headers.set("set-cookie", setCookie);
  return response;
}
