import { unstable_noStore as noStore } from "next/cache";
import { connection } from "next/server";

import { auth } from "@/lib/auth/server";

/**
 * Signed-in Wearer account id for data scoping. Admission is enforced by
 * `requireAdmittedAccess` / `assertAdmittedSession`, not here.
 */
export async function getWearerUserId(): Promise<string | null> {
  await connection();
  noStore();
  const { data } = await auth.getSession();
  const id = typeof data?.user?.id === "string" ? data.user.id.trim() : "";
  return id || null;
}
