import { redirect } from "next/navigation";
import { connection } from "next/server";

import { assertAdmittedSession } from "@/lib/auth/admitted";
import { auth } from "@/lib/auth/server";
import {
  acceptInviteToken,
  clearPendingInviteCookie,
  sessionEmailOf,
  writePendingInviteCookie,
} from "@/lib/auth/invites";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  await connection();
  const { token } = await context.params;
  const inviteToken = token.trim();
  if (!inviteToken) {
    redirect("/auth/not-admitted");
  }

  const gate = await assertAdmittedSession();
  if (gate.ok) {
    await clearPendingInviteCookie();
    redirect("/");
  }

  const { data } = await auth.getSession();
  if (!data?.user) {
    await writePendingInviteCookie(inviteToken);
    redirect("/auth/sign-in");
  }

  const email = sessionEmailOf(data.user);
  const userId =
    typeof data.user.id === "string" ? data.user.id.trim() : "";
  if (!email || !userId) {
    redirect("/auth/not-admitted");
  }

  const accepted = await acceptInviteToken({
    userId,
    email,
    token: inviteToken,
  });
  await clearPendingInviteCookie();
  if (accepted.ok) {
    redirect("/");
  }
  redirect("/auth/not-admitted");
}
