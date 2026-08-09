import { unstable_noStore as noStore } from "next/cache";
import { connection } from "next/server";

import { isAdminUser } from "@/lib/auth/admin";
import { auth } from "@/lib/auth/server";

/**
 * Signed-in admin Wearer account id for data scoping (Closet / Today / etc.).
 */
export async function getWearerUserId(): Promise<string | null> {
  await connection();
  noStore();
  const { data } = await auth.getSession();
  if (!data?.user || !isAdminUser(data.user)) return null;
  const id = typeof data.user.id === "string" ? data.user.id.trim() : "";
  return id || null;
}
