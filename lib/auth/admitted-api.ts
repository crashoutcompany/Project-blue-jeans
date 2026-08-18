import { NextResponse } from "next/server";

export function admittedRequiredJsonResponse(
  message = "This account has not been admitted to Blue Jeans.",
): NextResponse {
  return NextResponse.json({ ok: false as const, message }, { status: 403 });
}
