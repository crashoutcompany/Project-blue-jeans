import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { auth } from "@/lib/auth/server";

function adminEmailAllowlist(): Set<string> {
  const raw = process.env.APP_ADMIN_EMAILS?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Admin if Better Auth / Neon `role === "admin"`, or email is listed in
 * `APP_ADMIN_EMAILS` (comma-separated, case-insensitive). Use the env var when
 * the session payload does not yet include `role` everywhere (e.g. some API routes).
 */
export function isAdminUser(user: object | null | undefined): boolean {
  if (!user || typeof user !== "object") return false;
  const u = user as { role?: string | null; email?: string | null };
  if (u.role === "admin") return true;
  const email = u.email?.trim().toLowerCase();
  if (email && adminEmailAllowlist().has(email)) return true;
  return false;
}

/**
 * Server Components / layouts: require signed-in **admin** or redirect.
 */
export async function requireAdminAccess(): Promise<void> {
  await connection();
  noStore();
  const { data } = await auth.getSession();
  if (!data?.user) {
    redirect("/auth/sign-in");
  }
  if (!isAdminUser(data.user)) {
    redirect("/auth/not-admin");
  }
}

/**
 * Server actions only: never call `redirect()` here — it breaks the action
 * response protocol and surfaces as “An unexpected response was received from the server.”
 */
export async function assertAdminForServerAction(): Promise<
  { ok: true; userId: string } | { ok: false; message: string }
> {
  const { data } = await auth.getSession();
  if (!data?.user) {
    return { ok: false, message: "Sign in to continue." };
  }
  if (!isAdminUser(data.user)) {
    return {
      ok: false,
      message: "Admin access is required. Sign out and use an admin account.",
    };
  }
  const userId =
    typeof data.user.id === "string" ? data.user.id.trim() : "";
  if (!userId) {
    return { ok: false, message: "Session is missing a user id." };
  }
  return { ok: true, userId };
}

/**
 * For public routes (e.g. home): if someone is signed in but not admin, send them
 * to the explanation page.
 */
export async function redirectSignedInNonAdminFromPublicPage(): Promise<void> {
  await connection();
  noStore();
  const { data } = await auth.getSession();
  if (data?.user && !isAdminUser(data.user)) {
    redirect("/auth/not-admin");
  }
}
