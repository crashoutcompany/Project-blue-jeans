import { connection } from "next/server";

import { assertAdmittedSession } from "@/lib/auth/admitted";
import { auth } from "@/lib/auth/server";
import {
  acceptInviteToken,
  redirectClearingPendingInvite,
  redirectTo,
  redirectWithPendingInvite,
  sessionEmailOf,
} from "@/lib/auth/invites";

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  await connection();
  const { token } = await context.params;
  const inviteToken = token.trim();
  if (!inviteToken) {
    return redirectTo(request, "/auth/not-admitted");
  }

  const gate = await assertAdmittedSession();
  if (gate.ok) {
    return redirectClearingPendingInvite(request, "/");
  }

  const { data } = await auth.getSession();
  if (!data?.user) {
    return redirectWithPendingInvite(request, "/auth/sign-in", inviteToken);
  }

  const email = sessionEmailOf(data.user);
  const userId =
    typeof data.user.id === "string" ? data.user.id.trim() : "";
  if (!email || !userId) {
    return redirectTo(request, "/auth/not-admitted");
  }

  const accepted = await acceptInviteToken({
    userId,
    email,
    token: inviteToken,
  });
  if (accepted.ok) {
    return redirectClearingPendingInvite(request, "/");
  }
  return redirectClearingPendingInvite(request, "/auth/not-admitted");
}
