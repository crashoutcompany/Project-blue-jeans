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
 * Used only to bootstrap the platform-funded owner before `APP_OWNER_USER_ID`
 * / the owner membership row is seeded. Product access is admission, not admin.
 */
export function isAdminUser(user: object | null | undefined): boolean {
  if (!user || typeof user !== "object") return false;
  const u = user as { role?: string | null; email?: string | null };
  if (u.role === "admin") return true;
  const email = u.email?.trim().toLowerCase();
  if (email && adminEmailAllowlist().has(email)) return true;
  return false;
}
