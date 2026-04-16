import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/auth/admin";

export function adminRequiredJsonResponse(): NextResponse {
  return NextResponse.json(
    { ok: false as const, message: "Admin access is required for this app." },
    { status: 403 },
  );
}

export function sessionAllowsAdminApi(
  user: object | null | undefined,
): boolean {
  return isAdminUser(user);
}
