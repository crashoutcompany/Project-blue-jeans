// shared:test-auth-route v2
import { NextResponse } from "next/server";

import {
  createTestSession,
  evaluateTestAuthRequest,
  readTestAuthSecret,
} from "@/lib/auth/test-auth";

export function GET() {
  return new NextResponse(null, { status: 404 });
}

export async function POST(request: Request) {
  const decision = evaluateTestAuthRequest(readTestAuthSecret(request));
  if (!decision.allow) {
    return new NextResponse(null, { status: decision.status });
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
