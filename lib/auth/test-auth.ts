// shared:test-auth v2
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
import type { E2EEnvironment } from "@/lib/e2e-env";
import { isTestingApiExposed } from "@/lib/e2e-env";

export { TEST_AUTH_HEADER };
export const TEST_AUTH_USER_HEADER = "x-test-auth-user";

export type TestAuthEnv = E2EEnvironment & {
  NODE_ENV?: string;
  TEST_AUTH_SECRET?: string;
  VERCEL_ENV?: string;
};

export type TestAuthDecision =
  | { allow: true }
  | { allow: false; status: 401 | 404 };

function currentTestAuthEnv(): TestAuthEnv {
  return {
    EXPOSE_TESTING_API: process.env.EXPOSE_TESTING_API,
    NODE_ENV: process.env.NODE_ENV,
    TEST_AUTH_SECRET: process.env.TEST_AUTH_SECRET,
    VERCEL: process.env.VERCEL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  };
}

function readEnvValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function readConfiguredTestAuthSecret(
  secret: string | undefined,
): string | null {
  return readEnvValue(secret);
}

/** Header value from an incoming request (`x-test-auth-secret`). */
export function readTestAuthSecret(request: Request): string | null {
  return request.headers.get(TEST_AUTH_HEADER);
}

/**
 * RDC-strict gate: require EXPOSE_TESTING_API=1 and never enable on Vercel
 * production. Do not auto-enable from NODE_ENV=development or Vercel preview
 * alone.
 */
export function isTestAuthEnabled(
  env: TestAuthEnv = currentTestAuthEnv(),
): boolean {
  if (readConfiguredTestAuthSecret(env.TEST_AUTH_SECRET) === null) return false;

  const vercelEnv = readEnvValue(env.VERCEL_ENV);
  if (vercelEnv === "production") return false;

  return isTestingApiExposed(env);
}

export function isValidTestAuthSecret(
  providedSecret: string | null,
  env: TestAuthEnv = currentTestAuthEnv(),
): boolean {
  const expected = readConfiguredTestAuthSecret(env.TEST_AUTH_SECRET);
  return Boolean(expected) && constantTimeEqual(providedSecret ?? "", expected!);
}

export function evaluateTestAuthRequest(
  headerValue: string | null,
  env: TestAuthEnv = currentTestAuthEnv(),
): TestAuthDecision {
  if (!isTestAuthEnabled(env)) {
    return { allow: false, status: 404 };
  }

  const expected = readConfiguredTestAuthSecret(env.TEST_AUTH_SECRET);
  if (!expected) {
    return { allow: false, status: 404 };
  }

  if (!constantTimeEqual(headerValue ?? "", expected)) {
    return { allow: false, status: 401 };
  }

  return { allow: true };
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

/** App-specific: Neon SQL + wearer membership admission. */
export async function createTestSession(request: Request) {
  const tester = testerFromRequest(request);
  const context = await auth.$context;
  const existing = await context.internalAdapter.findUserByEmail(tester.email);
  const user =
    existing?.user ??
    (await context.internalAdapter.createUser(
      {
        id: tester.id,
        email: tester.email,
        name: tester.name,
        emailVerified: true,
      },
      { method: "admin" },
    ));

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
