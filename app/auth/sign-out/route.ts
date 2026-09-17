import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export async function GET(request: Request) {
  const signOutResponse = await auth.api.signOut({
    headers: request.headers,
    asResponse: true,
  });
  const response = NextResponse.redirect(new URL("/signin", request.url));
  const setCookie = signOutResponse.headers.get("set-cookie");
  if (setCookie) response.headers.set("set-cookie", setCookie);
  return response;
}
