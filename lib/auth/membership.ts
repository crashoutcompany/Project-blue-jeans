import "server-only";

import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  formCsrfMiddleware,
} from "better-auth/api";

import {
  logOtpFailure,
  normalizeOtpEmail,
  otpEmailLogHash,
} from "./email-otp";
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
 * `APP_OWNER_USER_ID` is set it must match. Production requires it, so a stray
 * owner row alone can never spend the platform keys.
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
  if (configuredOwner) {
    return configuredOwner === userId;
  }
  return process.env.VERCEL_ENV?.trim() !== "production";
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
    let row: MembershipRow | undefined;
    try {
      const rows = (await sql`
        SELECT user_id, access_role, credential_source, status
        FROM wearer_memberships
        WHERE user_id = ${userId}
        LIMIT 1
      `) as MembershipRow[];
      row = rows[0];
    } catch (error) {
      console.error("[membership] getMembershipPolicy failed", error);
      throw new MembershipStoreUnavailableError();
    }

    if (row) {
      const policy = membershipFromRow(row);
      if (policy) return policy;
      /**
       * A row exists but its role or status is not one this build knows, so it
       * cannot be evaluated. Falling through would hand the configured owner a
       * full platform membership and defeat "database policy wins" — exactly
       * the bypass that rule exists to prevent.
       */
      console.error(
        "[membership] unreadable membership row",
        `access_role=${row.access_role} status=${row.status}`,
      );
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

/**
 * Email-code sign-in is for allowlisted bots. It must never open the owner's
 * account, even if the owner's email lands on the allowlist by mistake. A
 * store failure throws, which blocks the sign-in (fail closed).
 */
export async function isOtpSignInBlockedForUser(
  userIdInput: string,
): Promise<boolean> {
  const userId = userIdInput.trim();
  if (!userId) return true;
  if (ownerBootstrapUserId() === userId) return true;
  const policy = await getMembershipPolicy(userId);
  return policy?.accessRole === "owner";
}

type GuardContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

/** Lookups run this many times in total before the guard fails closed. */
const LOOKUP_ATTEMPTS = 2;

type OtpCandidate = {
  userId: string;
  /** Owner, or any account with a linked provider (OAuth or password). */
  blocked: boolean;
};

type Lookup =
  | { failed: false; candidate: OtpCandidate | null }
  | { failed: true };

/** Error name and message, with the address removed in case a driver echoes it. */
function describeLookupError(error: unknown, email: string) {
  const name = error instanceof Error ? error.name : typeof error;
  const message = error instanceof Error ? error.message : "";
  return { name, message: message.split(email).join("[redacted]") };
}

/**
 * Loads the user for an email, that user's accounts by `userId`, and the
 * owner membership check. Returns null when no user has the email. The
 * membership check runs inside the retry too, so a membership store failure
 * is answered like a lookup failure, not as a server error that would reveal
 * the account exists.
 */
async function findOtpCandidate(
  ctx: GuardContext,
  email: string,
): Promise<OtpCandidate | null> {
  const internal = ctx.context.internalAdapter;
  const found = await internal.findUserByEmail(email);
  if (!found) return null;
  const userId = found.user.id;
  const accounts = await internal.findAccounts(userId);
  const blocked =
    accounts.length > 0 || (await isOtpSignInBlockedForUser(userId));
  return { userId, blocked };
}

/**
 * Retries the lookup once. If every attempt fails, the guard logs the failure
 * by hash and returns `{ failed: true }`. The caller then answers as if the
 * address were unlisted, so a lookup failure does not reveal that the address
 * is listed. The raw email is never logged.
 */
async function lookupOtpCandidate(
  ctx: GuardContext,
  email: string,
  logSecret: string | undefined,
): Promise<Lookup> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= LOOKUP_ATTEMPTS; attempt += 1) {
    try {
      return { failed: false, candidate: await findOtpCandidate(ctx, email) };
    } catch (error) {
      lastError = error;
    }
  }
  console.error("otp_guard_lookup_failed", {
    attempts: LOOKUP_ATTEMPTS,
    emailHash: otpEmailLogHash(email, logSecret),
    error: describeLookupError(lastError, email),
  });
  return { failed: true };
}

function invalidOtpError(): APIError {
  return APIError.from("BAD_REQUEST", {
    code: "INVALID_OTP",
    message: "Invalid OTP",
  });
}

/**
 * Blue Jeans-only guard next to the shared email OTP plugins: refuse email
 * OTP sign-in into the owner account or any account with a linked provider. A
 * user created by email OTP has a fresh id with no membership, so it is
 * un-invited until the owner invites it as a `wearer` (`user_byok`); it can
 * never pick up `platform_env`.
 *
 * `logSecret` keys the email hash in logs. Pass the same Better Auth secret
 * given to `createEmailOtpPlugins`.
 *
 * Blocked accounts can never use a code, so no code is stored or emailed for
 * them. A lookup that fails after the retry is answered the same way as an
 * unlisted address, so a failure does not reveal that the address is listed.
 * Sign-in answers blocked and failed lookups with the same INVALID_OTP as a
 * wrong code.
 */
export function createOtpOwnerGuardPlugin(
  options: { logSecret?: string } = {},
): BetterAuthPlugin {
  const { logSecret } = options;
  return {
    id: "email-otp-owner-guard",
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === "/email-otp/send-verification-otp",
          handler: createAuthMiddleware(async (ctx) => {
            const body = ctx.body as
              | { email?: unknown; type?: unknown }
              | undefined;
            if (body?.type !== "sign-in" || typeof body.email !== "string") {
              return;
            }
            const email = normalizeOtpEmail(body.email);
            const lookup = await lookupOtpCandidate(ctx, email, logSecret);
            if (!lookup.failed && !lookup.candidate?.blocked) return;
            if (!lookup.failed && lookup.candidate) {
              logOtpFailure("otp_account_blocked", {
                email,
                userId: lookup.candidate.userId,
                logSecret,
              });
            }
            // Blocked and failed lookups take the same path as an unlisted
            // address: the CSRF check the endpoint would run, then its success
            // body. No code is stored or emailed.
            await formCsrfMiddleware(ctx);
            return ctx.json({ success: true });
          }),
        },
        {
          matcher: (ctx) => ctx.path === "/sign-in/email-otp",
          handler: createAuthMiddleware(async (ctx) => {
            const body = ctx.body as { email?: unknown } | undefined;
            if (typeof body?.email !== "string") return;
            const email = normalizeOtpEmail(body.email);
            const lookup = await lookupOtpCandidate(ctx, email, logSecret);
            if (lookup.failed) throw invalidOtpError();
            if (lookup.candidate?.blocked) {
              logOtpFailure("otp_account_blocked", {
                email,
                userId: lookup.candidate.userId,
                logSecret,
              });
              throw invalidOtpError();
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
