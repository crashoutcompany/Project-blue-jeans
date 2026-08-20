import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { isAdminUser } from "@/lib/auth/admin";
import { auth } from "@/lib/auth/server";
import {
  getMembershipPolicy,
  MembershipStoreUnavailableError,
  ownerBootstrapUserId,
  platformOwnerMembership,
  type MembershipPolicy,
} from "@/lib/auth/membership";

export type AdmittedSession =
  | { ok: true; userId: string; membership: MembershipPolicy }
  | { ok: false; status: 401 | 403 | 503; message: string };

function canBootstrapOwnerFromSession(user: object, userId: string): boolean {
  if (ownerBootstrapUserId() === userId) {
    return true;
  }
  return process.env.E2E_PLAYWRIGHT === "1" && isAdminUser(user);
}

/**
 * Session-aware lookup: production bootstraps only the configured
 * `APP_OWNER_USER_ID`. Playwright's admin cookie may bootstrap while
 * `E2E_PLAYWRIGHT=1`.
 */
export async function getMembershipPolicyForUser(
  user: object,
): Promise<MembershipPolicy | null> {
  const userId =
    "id" in user && typeof user.id === "string" ? user.id.trim() : "";
  if (!userId) return null;

  const policy = await getMembershipPolicy(userId);
  if (policy) return policy;
  if (canBootstrapOwnerFromSession(user, userId)) {
    return platformOwnerMembership(userId);
  }
  return null;
}

function isActiveMembership(
  membership: MembershipPolicy | null,
): membership is MembershipPolicy {
  return membership != null && membership.status === "active";
}

/**
 * Signed-in Wearer with an active membership (or configured owner bootstrap).
 * Use inside route handlers — do not call `redirect()` here.
 */
export async function assertAdmittedSession(): Promise<AdmittedSession> {
  let session: Awaited<ReturnType<typeof auth.getSession>>;
  try {
    session = await auth.getSession();
  } catch {
    return { ok: false, status: 401, message: "Sign in to continue." };
  }
  const data = session.data;
  if (!data?.user) {
    return { ok: false, status: 401, message: "Sign in to continue." };
  }

  try {
    const membership = await getMembershipPolicyForUser(data.user);
    if (!isActiveMembership(membership)) {
      return {
        ok: false,
        status: 403,
        message: membership
          ? "This account is not active."
          : "This account has not been admitted to Blue Jeans.",
      };
    }
    return { ok: true, userId: membership.userId, membership };
  } catch (error) {
    if (error instanceof MembershipStoreUnavailableError) {
      return { ok: false, status: 503, message: error.message };
    }
    throw error;
  }
}

/**
 * Server actions / JSON mutations: never call `redirect()` here.
 */
export async function assertAdmittedForServerAction(): Promise<
  | { ok: true; userId: string; membership: MembershipPolicy }
  | { ok: false; message: string }
> {
  const gate = await assertAdmittedSession();
  if (!gate.ok) {
    return { ok: false, message: gate.message };
  }
  return {
    ok: true,
    userId: gate.userId,
    membership: gate.membership,
  };
}

/**
 * Server Components / layouts: require an active admitted session or redirect.
 */
export async function requireAdmittedAccess(): Promise<void> {
  await connection();
  noStore();
  const gate = await assertAdmittedSession();
  if (gate.ok) return;
  if (gate.status === 401) {
    redirect("/auth/sign-in");
  }
  if (gate.status === 503) {
    throw new MembershipStoreUnavailableError(gate.message);
  }
  redirect("/auth/accept-invite");
}
