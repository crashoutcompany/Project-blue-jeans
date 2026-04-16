import { unstable_noStore as noStore } from "next/cache";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";

/**
 * Server-only session check (signed-in user, any role).
 * The authenticated app shell uses {@link requireAdminAccess} instead.
 */
export async function requireUser() {
  await connection();
  noStore();
  const { data } = await auth.getSession();
  if (!data?.user) {
    redirect("/auth/sign-in");
  }
  return data;
}
