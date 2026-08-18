import "server-only";

import { requireSql } from "@/lib/db";

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

function ownerBootstrapUserId(): string | null {
  return process.env.APP_OWNER_USER_ID?.trim() || null;
}

/**
 * Database policy wins over the bootstrap env value so deletion cannot be
 * bypassed by a stale deployment configuration.
 */
export async function getMembershipPolicy(
  userIdInput: string,
): Promise<MembershipPolicy | null> {
  const userId = userIdInput.trim();
  if (!userId) return null;

  const sql = requireSql();
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
