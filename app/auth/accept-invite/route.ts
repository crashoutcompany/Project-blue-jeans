import { connection } from "next/server";

import { assertAdmittedSession } from "@/lib/auth/admitted";
import { auth } from "@/lib/auth/server";
import {
  acceptInviteToken,
  readPendingInviteCookie,
  redirectClearingPendingInvite,
  redirectTo,
  sessionEmailOf,
} from "@/lib/auth/invites";

/**
 * Completes a pending invite cookie after sign-in, then sends the Wearer
 * home or to the wait screen.
 */
export async function GET(request: Request) {
  await connection();
  const gate = await assertAdmittedSession();
  if (gate.ok) {
    return redirectClearingPendingInvite(request, "/");
  }
  if (gate.status === 401) {
    return redirectTo(request, "/auth/sign-in");
  }

  const { data } = await auth.getSession();
  const user = data?.user;
  const token = await readPendingInviteCookie();
  const email = user ? sessionEmailOf(user) : null;
  const userId =
    user && "id" in user && typeof user.id === "string" ? user.id.trim() : "";

  if (token && email && userId) {
    const accepted = await acceptInviteToken({ userId, email, token });
    if (accepted.ok) {
      return redirectClearingPendingInvite(request, "/");
    }
  }

  return redirectClearingPendingInvite(request, "/auth/not-admitted");
}
