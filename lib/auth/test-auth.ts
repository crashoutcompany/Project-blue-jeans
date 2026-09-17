import { constantTimeEqual, makeSignature } from "better-auth/crypto";

import { auth } from "@/lib/auth";
import {
  NON_ADMITTED_TESTER_EMAIL,
  NON_ADMITTED_TESTER_ID,
  NON_ADMITTED_TESTER_NAME,
  TEST_AUTH_HEADER,
  TESTER_EMAIL,
  TESTER_ID,
  TESTER_NAME,
} from "@/lib/auth/config";
import { getSql } from "@/lib/db";

export const TEST_AUTH_USER_HEADER = "x-test-auth-user";

export function isTestAuthEnabled() {
  if (!process.env.TEST_AUTH_SECRET) return false;
  if (process.env.VERCEL_ENV === "production") return false;
  if (process.env.VERCEL_ENV === "preview") return true;
  if (process.env.VERCEL_ENV === "development") return true;
  if (process.env.VERCEL === "1") return false;
  return (
    process.env.NODE_ENV === "development" ||
    process.env.EXPOSE_TESTING_API === "1"
  );
}

export function isValidTestAuthSecret(value: string | null) {
  const expected = process.env.TEST_AUTH_SECRET;
  return Boolean(expected) && constantTimeEqual(value ?? "", expected!);
}

export function readTestAuthSecret(request: Request) {
  return request.headers.get(TEST_AUTH_HEADER);
}

function testerFromRequest(request: Request) {
  if (request.headers.get(TEST_AUTH_USER_HEADER) === "non-admitted") {
    return {
      id: NON_ADMITTED_TESTER_ID,
      email: NON_ADMITTED_TESTER_EMAIL,
      name: NON_ADMITTED_TESTER_NAME,
      admitted: false,
    };
  }
  return {
    id: TESTER_ID,
    email: TESTER_EMAIL,
    name: TESTER_NAME,
    admitted: true,
  };
}

export async function createTestSession(request: Request) {
  const tester = testerFromRequest(request);
  const context = await auth.$context;
  const existing = await context.internalAdapter.findUserByEmail(tester.email);
  const user =
    existing?.user ??
    (await context.internalAdapter.createUser({
      id: tester.id,
      email: tester.email,
      name: tester.name,
      emailVerified: true,
    }, { method: "admin" }));

  const sql = getSql();
  if (!sql) throw new Error("DATABASE_URL is required for test login");

  if (tester.admitted) {
    await sql`
      INSERT INTO wearer_memberships (
        user_id,
        access_role,
        credential_source,
        status
      )
      VALUES (${user.id}, 'wearer', 'user_byok', 'active')
      ON CONFLICT (user_id) DO UPDATE SET
        access_role = 'wearer',
        credential_source = 'user_byok',
        status = 'active',
        updated_at = now()
    `;
  } else {
    await sql`DELETE FROM wearer_memberships WHERE user_id = ${user.id}`;
  }

  const session = await context.internalAdapter.createSession(user.id);
  const signature = await makeSignature(
    session.token,
    process.env.BETTER_AUTH_SECRET!,
  );
  const cookie = context.authCookies.sessionToken;

  return {
    cookie,
    cookieValue: `${session.token}.${signature}`,
    session,
    user,
  };
}
