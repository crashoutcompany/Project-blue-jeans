import "server-only";

import { getSql } from "@/lib/db";

export type MembershipPolicy = {
  userId: string;
  accessRole: "owner" | "wearer";
  credentialSource: "platform_env" | "user_byok";
  status: "active" | "deleting";
  persisted: boolean;
};

type MembershipRow = {
  user_id: string;
  access_role: MembershipPolicy["accessRole"];
  credential_source: MembershipPolicy["credentialSource"];
  status: MembershipPolicy["status"];
};

export class MembershipStoreUnavailableError extends Error {
  constructor(message = "Could not verify admission. Try again.") {
    super(message);
    this.name = "MembershipStoreUnavailableError";
  }
}

export function ownerBootstrapUserId(): string | null {
  return process.env.APP_OWNER_USER_ID?.trim() || null;
}

/**
 * Database policy wins over the bootstrap env value so deletion cannot be
 * bypassed by a stale deployment configuration. A configured database that
 * fails to answer is not treated as a missing row.
 */
export async function getMembershipPolicy(
  userIdInput: string,
): Promise<MembershipPolicy | null> {
  const userId = userIdInput.trim();
  if (!userId) return null;

  const sql = getSql();
  if (sql) {
    try {
      const rows = (await sql`
        SELECT user_id, access_role, credential_source, status
        FROM wearer_memberships
        WHERE user_id = ${userId}
        LIMIT 1
      `) as MembershipRow[];
      const row = rows[0];
      if (row) {
        return {
          userId: row.user_id,
          accessRole: row.access_role,
          credentialSource: row.credential_source,
          status: row.status,
          persisted: true,
        };
      }
    } catch (error) {
      console.error("[membership] getMembershipPolicy failed", error);
      throw new MembershipStoreUnavailableError();
    }
  }

  if (ownerBootstrapUserId() === userId) {
    return platformOwnerMembership(userId);
  }
  return null;
}

export function platformOwnerMembership(userId: string): MembershipPolicy {
  return {
    userId,
    accessRole: "owner",
    credentialSource: "platform_env",
    status: "active",
    persisted: false,
  };
}
