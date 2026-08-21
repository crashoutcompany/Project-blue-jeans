import "server-only";

import { getSql } from "@/lib/db";

export type MembershipPolicy = {
  userId: string;
  accessRole: "owner" | "wearer";
  credentialSource: "platform_env" | "user_byok";
  status: "active" | "deleting";
  persisted: boolean;
};

export type MembershipRow = {
  user_id: string;
  access_role: string;
  credential_source: string;
  status: string;
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

function parseAccessRole(
  value: string | null | undefined,
): MembershipPolicy["accessRole"] | null {
  if (value === "owner" || value === "wearer") return value;
  return null;
}

function parseMembershipStatus(
  value: string | null | undefined,
): MembershipPolicy["status"] | null {
  if (value === "active" || value === "deleting") return value;
  return null;
}

/**
 * Pair owner↔platform_env and wearer↔user_byok even if the database CHECK
 * is missing. Invited Wearers must never inherit `platform_env`.
 */
export function membershipFromRow(row: MembershipRow): MembershipPolicy | null {
  const userId = row.user_id?.trim();
  const accessRole = parseAccessRole(row.access_role);
  const status = parseMembershipStatus(row.status);
  if (!userId || !accessRole || !status) return null;

  return {
    userId,
    accessRole,
    credentialSource: accessRole === "owner" ? "platform_env" : "user_byok",
    status,
    persisted: true,
  };
}

export function isPlatformFundedOwner(
  membership: MembershipPolicy | null | undefined,
): membership is MembershipPolicy {
  return (
    membership != null &&
    membership.status === "active" &&
    membership.accessRole === "owner" &&
    membership.credentialSource === "platform_env"
  );
}

/**
 * Only the active owner may charge `GOOGLE_GENERATIVE_AI_API_KEY` /
 * `UPLOADTHING_TOKEN`. The membership must belong to `userId`. When
 * `APP_OWNER_USER_ID` is set in production it must match; Playwright
 * (`E2E_PLAYWRIGHT=1`) may still bootstrap its harness owner.
 */
export function membershipAllowsPlatformCredentials(
  membership: MembershipPolicy | null | undefined,
  userIdInput: string,
): boolean {
  const userId = userIdInput.trim();
  if (!userId || !isPlatformFundedOwner(membership) || membership.userId !== userId) {
    return false;
  }

  const configuredOwner = ownerBootstrapUserId();
  if (configuredOwner && process.env.E2E_PLAYWRIGHT !== "1") {
    return configuredOwner === userId;
  }
  return true;
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
        return membershipFromRow(row);
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
