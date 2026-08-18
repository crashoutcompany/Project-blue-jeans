import "server-only";

import { isAdminUser } from "@/lib/auth/admin";
import { auth } from "@/lib/auth/server";
import {
  getMembershipPolicy,
  platformOwnerMembership,
  type MembershipPolicy,
} from "@/lib/auth/membership";

export type AdmittedSession =
  | { ok: true; userId: string; membership: MembershipPolicy }
  | { ok: false; status: 401 | 403; message: string };

/**
 * Session-aware lookup: a signed-in admin without a membership row is treated
 * as the platform-funded owner so existing deployments keep working before
 * `APP_OWNER_USER_ID` / the owner row is seeded.
 */
export async function getMembershipPolicyForUser(
  user: object,
): Promise<MembershipPolicy | null> {
  const userId =
    "id" in user && typeof user.id === "string" ? user.id.trim() : "";
  if (!userId) return null;

  const policy = await getMembershipPolicy(userId);
  if (policy) return policy;
  if (isAdminUser(user)) return platformOwnerMembership(userId);
  return null;
}

/**
 * Signed-in Wearer with an active membership (or admin owner bootstrap).
 * Use inside route handlers — do not call `redirect()` here.
 */
export async function assertAdmittedSession(): Promise<AdmittedSession> {
  const { data } = await auth.getSession();
  if (!data?.user) {
    return { ok: false, status: 401, message: "Sign in to continue." };
  }

  const membership = await getMembershipPolicyForUser(data.user);
  if (!membership) {
    return {
      ok: false,
      status: 403,
      message: "This account has not been admitted to Blue Jeans.",
    };
  }
  if (membership.status !== "active") {
    return {
      ok: false,
      status: 403,
      message: "This account is not active.",
    };
  }
  return { ok: true, userId: membership.userId, membership };
}
