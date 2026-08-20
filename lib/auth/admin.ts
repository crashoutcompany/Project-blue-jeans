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
 * Neon Auth `role=admin` / `APP_ADMIN_EMAILS` are not product admission.
 * Production owner bootstrap is `APP_OWNER_USER_ID` only. This helper remains
 * for admin-only APIs and the Playwright harness (`E2E_PLAYWRIGHT=1`).
 */
export function isAdminUser(user: object | null | undefined): boolean {
  if (!user || typeof user !== "object") return false;
  const u = user as { role?: string | null; email?: string | null };
  if (u.role === "admin") return true;
  const email = u.email?.trim().toLowerCase();
  if (email && adminEmailAllowlist().has(email)) return true;
  return false;
}
