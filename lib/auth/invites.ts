import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import type { MembershipPolicy } from "@/lib/auth/membership";
import { requireSql } from "@/lib/db";
import { logServerError } from "@/lib/server/safe-client-error";

export const PENDING_INVITE_COOKIE = "pending_invite";
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type PendingInvite = {
  id: string;
  email: string;
  expiresAt: string;
};

export function normalizeInviteEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionEmailOf(user: object): string | null {
  if (!("email" in user) || typeof user.email !== "string") return null;
  const email = normalizeInviteEmail(user.email);
  return email || null;
}

type InviteRow = {
  id: string;
  email_normalized: string;
  expires_at: Date | string;
};

export async function createWearerInvite(input: {
  owner: MembershipPolicy;
  email: string;
}): Promise<
  | { ok: true; token: string; email: string; expiresAt: string }
  | { ok: false; message: string }
> {
  if (input.owner.accessRole !== "owner") {
    return { ok: false, message: "Only the owner can invite Wearers." };
  }

  const email = normalizeInviteEmail(input.email);
  if (!email || !email.includes("@") || email.length > 320) {
    return { ok: false, message: "Enter an email address." };
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashInviteToken(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
  const sql = requireSql();

  try {
    await sql`
      DELETE FROM wearer_invitations
      WHERE email_normalized = ${email}
        AND accepted_at IS NULL
        AND revoked_at IS NULL
        AND expires_at <= now()
    `;
    await sql`
      INSERT INTO wearer_invitations (
        email_normalized,
        token_hash,
        invited_by_user_id,
        expires_at
      )
      VALUES (
        ${email},
        ${tokenHash},
        ${input.owner.userId},
        ${expiresAt}::timestamptz
      )
    `;
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? error.code
        : undefined;
    if (code === "23505") {
      return {
        ok: false,
        message: "An open invite already exists for that email.",
      };
    }
    throw error;
  }

  return { ok: true, token, email, expiresAt };
}

export async function listPendingInvites(
  ownerUserId: string,
): Promise<PendingInvite[]> {
  const sql = requireSql();
  const rows = (await sql`
    SELECT id::text AS id, email_normalized, expires_at
    FROM wearer_invitations
    WHERE invited_by_user_id = ${ownerUserId}
      AND accepted_at IS NULL
      AND revoked_at IS NULL
      AND expires_at > now()
    ORDER BY created_at DESC
  `) as InviteRow[];

  return rows.map((row) => ({
    id: row.id,
    email: row.email_normalized,
    expiresAt:
      row.expires_at instanceof Date
        ? row.expires_at.toISOString()
        : row.expires_at,
  }));
}

export async function acceptInviteToken(input: {
  userId: string;
  email: string;
  token: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const email = normalizeInviteEmail(input.email);
  const token = input.token.trim();
  if (!token) {
    return { ok: false, message: "That invite link is invalid." };
  }

  const sql = requireSql();
  const tokenHash = hashInviteToken(token);
  const rows = (await sql`
    SELECT id::text AS id, email_normalized
    FROM wearer_invitations
    WHERE token_hash = ${tokenHash}
      AND accepted_at IS NULL
      AND revoked_at IS NULL
      AND expires_at > now()
    LIMIT 1
  `) as Array<{ id: string; email_normalized: string }>;

  const invite = rows[0];
  if (!invite) {
    return { ok: false, message: "That invite has expired or already been used." };
  }
  if (invite.email_normalized !== email) {
    return {
      ok: false,
      message: "Sign in with the email this invite was sent to.",
    };
  }

  try {
    const consumed = (await sql`
      WITH inserted AS (
        INSERT INTO wearer_memberships (
          user_id,
          access_role,
          credential_source,
          status,
          invited_by_user_id
        )
        SELECT
          ${input.userId},
          'wearer',
          'user_byok',
          'active',
          invited_by_user_id
        FROM wearer_invitations
        WHERE id = ${invite.id}::uuid
          AND NOT EXISTS (
            SELECT 1
            FROM wearer_memberships
            WHERE user_id = ${input.userId}
          )
        RETURNING user_id
      )
      UPDATE wearer_invitations w
      SET accepted_at = now(), accepted_user_id = ${input.userId}
      FROM inserted
      WHERE w.id = ${invite.id}::uuid
        AND w.accepted_at IS NULL
      RETURNING w.id
    `) as Array<{ id: string }>;
    if (!consumed[0]) {
      return {
        ok: false,
        message: "This account already has a membership.",
      };
    }
  } catch (error) {
    logServerError("acceptInviteToken", error);
    return { ok: false, message: "Could not accept that invite. Try again." };
  }

  return { ok: true };
}

export async function readPendingInviteCookie(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(PENDING_INVITE_COOKIE)?.value?.trim();
  return token || null;
}

function pendingInviteCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    secure: process.env.NODE_ENV === "production",
  };
}

/** Attach cookies to a Route Handler redirect — never cookies().set() then redirect(). */
export function redirectTo(request: Request, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url));
}

export function redirectWithPendingInvite(
  request: Request,
  path: string,
  token: string,
): NextResponse {
  const response = redirectTo(request, path);
  response.cookies.set(
    PENDING_INVITE_COOKIE,
    token,
    pendingInviteCookieOptions(Math.floor(INVITE_TTL_MS / 1000)),
  );
  return response;
}

export function redirectClearingPendingInvite(
  request: Request,
  path: string,
): NextResponse {
  const response = redirectTo(request, path);
  response.cookies.set(
    PENDING_INVITE_COOKIE,
    "",
    pendingInviteCookieOptions(0),
  );
  return response;
}
