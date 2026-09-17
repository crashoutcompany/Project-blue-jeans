import { NextResponse } from "next/server";

import {
  createTestSession,
  isTestAuthEnabled,
  isValidTestAuthSecret,
  readTestAuthSecret,
} from "@/lib/auth/test-auth";

export function GET() {
  return new NextResponse(null, { status: 404 });
}

export async function POST(request: Request) {
  if (!isTestAuthEnabled()) {
    return new NextResponse(null, { status: 404 });
  }
  if (!isValidTestAuthSecret(readTestAuthSecret(request))) {
    return new NextResponse(null, { status: 401 });
  }

  const { cookie, cookieValue, session, user } =
    await createTestSession(request);
  const response = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email },
  });
  response.cookies.set({
    name: cookie.name,
    value: cookieValue,
    httpOnly: cookie.attributes.httpOnly ?? true,
    secure: cookie.attributes.secure ?? false,
    sameSite: "lax",
    path: cookie.attributes.path ?? "/",
    expires: session.expiresAt,
  });
  return response;
}
