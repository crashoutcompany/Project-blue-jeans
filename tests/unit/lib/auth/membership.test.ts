import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resendSend = vi.hoisted(() => vi.fn());
vi.mock("resend", () => ({
  Resend: vi.fn(function Resend() {
    return { emails: { send: resendSend } };
  }),
}));

vi.mock("@/lib/db", () => ({
  getSql: vi.fn(),
  requireSql: vi.fn(),
}));

import {
  createEmailOtpPlugins,
  otpEmailLogHash,
} from "@/lib/auth/email-otp";
import {
  createOtpOwnerGuardPlugin,
  getMembershipPolicy,
  isOtpSignInBlockedForUser,
  membershipAllowsPlatformCredentials,
  membershipFromRow,
  MembershipStoreUnavailableError,
} from "@/lib/auth/membership";
import { getSql } from "@/lib/db";

const getSqlMock = vi.mocked(getSql);

describe("membership policy", () => {
  const originalOwnerId = process.env.APP_OWNER_USER_ID;

  beforeEach(() => {
    getSqlMock.mockReset();
    delete process.env.APP_OWNER_USER_ID;
  });

  afterEach(() => {
    if (originalOwnerId === undefined) {
      delete process.env.APP_OWNER_USER_ID;
    } else {
      process.env.APP_OWNER_USER_ID = originalOwnerId;
    }
  });

  it("uses the owner env id only to bootstrap a missing row", async () => {
    process.env.APP_OWNER_USER_ID = "owner-1";
    getSqlMock.mockReturnValue(vi.fn().mockResolvedValueOnce([]) as never);

    await expect(getMembershipPolicy("owner-1")).resolves.toEqual({
      userId: "owner-1",
      accessRole: "owner",
      credentialSource: "platform_env",
      status: "active",
      persisted: false,
    });
  });

  it("lets a persisted deleting state override a stale owner env id", async () => {
    process.env.APP_OWNER_USER_ID = "owner-1";
    getSqlMock.mockReturnValue(
      vi.fn().mockResolvedValueOnce([
        {
          user_id: "owner-1",
          access_role: "owner",
          credential_source: "platform_env",
          status: "deleting",
        },
      ]) as never,
    );

    await expect(getMembershipPolicy("owner-1")).resolves.toEqual(
      expect.objectContaining({ status: "deleting", persisted: true }),
    );
  });

  it("bootstraps the env owner when the database is unset", async () => {
    process.env.APP_OWNER_USER_ID = "owner-1";
    getSqlMock.mockReturnValue(undefined);

    await expect(getMembershipPolicy("owner-1")).resolves.toEqual({
      userId: "owner-1",
      accessRole: "owner",
      credentialSource: "platform_env",
      status: "active",
      persisted: false,
    });
  });

  it("returns null without a database or owner bootstrap", async () => {
    getSqlMock.mockReturnValue(undefined);

    await expect(getMembershipPolicy("wearer-1")).resolves.toBeNull();
  });

  it("fails closed when a configured database cannot be queried", async () => {
    process.env.APP_OWNER_USER_ID = "owner-1";
    getSqlMock.mockReturnValue(
      vi.fn().mockRejectedValueOnce(new Error("db down")) as never,
    );

    await expect(getMembershipPolicy("owner-1")).rejects.toBeInstanceOf(
      MembershipStoreUnavailableError,
    );
  });

  it("coerces a Wearer row away from platform_env", async () => {
    getSqlMock.mockReturnValue(
      vi.fn().mockResolvedValueOnce([
        {
          user_id: "wearer-1",
          access_role: "wearer",
          credential_source: "platform_env",
          status: "active",
        },
      ]) as never,
    );

    await expect(getMembershipPolicy("wearer-1")).resolves.toEqual({
      userId: "wearer-1",
      accessRole: "wearer",
      credentialSource: "user_byok",
      status: "active",
      persisted: true,
    });
  });

  /**
   * A row this build cannot read is not the same as a missing row. Reporting
   * it as missing let the caller fall through to the APP_OWNER_USER_ID
   * bootstrap, handing out a platform owner membership over a stored row that
   * never said "owner" — the bypass "database policy wins" exists to prevent.
   */
  it("refuses to evaluate a row with an unknown access role", async () => {
    getSqlMock.mockReturnValue(
      vi.fn().mockResolvedValueOnce([
        {
          user_id: "wearer-1",
          access_role: "admin",
          credential_source: "platform_env",
          status: "active",
        },
      ]) as never,
    );

    await expect(getMembershipPolicy("wearer-1")).rejects.toBeInstanceOf(
      MembershipStoreUnavailableError,
    );
  });

  it("refuses to evaluate a row with an unknown status", async () => {
    getSqlMock.mockReturnValue(
      vi.fn().mockResolvedValueOnce([
        {
          user_id: "owner-1",
          access_role: "owner",
          credential_source: "platform_env",
          status: "suspended",
        },
      ]) as never,
    );

    await expect(getMembershipPolicy("owner-1")).rejects.toBeInstanceOf(
      MembershipStoreUnavailableError,
    );
  });

  it("does not bootstrap the configured owner past an unreadable row", async () => {
    process.env.APP_OWNER_USER_ID = "owner-1";
    getSqlMock.mockReturnValue(
      vi.fn().mockResolvedValueOnce([
        {
          user_id: "owner-1",
          access_role: "admin",
          credential_source: "platform_env",
          status: "active",
        },
      ]) as never,
    );

    await expect(getMembershipPolicy("owner-1")).rejects.toBeInstanceOf(
      MembershipStoreUnavailableError,
    );
  });
});

describe("membershipFromRow", () => {
  it("pairs owner with platform_env and wearer with user_byok", () => {
    expect(
      membershipFromRow({
        user_id: "owner-1",
        access_role: "owner",
        credential_source: "user_byok",
        status: "active",
      }),
    ).toEqual({
      userId: "owner-1",
      accessRole: "owner",
      credentialSource: "platform_env",
      status: "active",
      persisted: true,
    });
    expect(
      membershipFromRow({
        user_id: "wearer-1",
        access_role: "wearer",
        credential_source: "platform_env",
        status: "active",
      })?.credentialSource,
    ).toBe("user_byok");
  });
});

describe("membershipAllowsPlatformCredentials", () => {
  const originalOwnerId = process.env.APP_OWNER_USER_ID;

  beforeEach(() => {
    delete process.env.APP_OWNER_USER_ID;
  });

  afterEach(() => {
    if (originalOwnerId === undefined) {
      delete process.env.APP_OWNER_USER_ID;
    } else {
      process.env.APP_OWNER_USER_ID = originalOwnerId;
    }
  });

  const owner = {
    userId: "owner-1",
    accessRole: "owner" as const,
    credentialSource: "platform_env" as const,
    status: "active" as const,
    persisted: true,
  };

  it("allows only the matching active owner", () => {
    expect(membershipAllowsPlatformCredentials(owner, "owner-1")).toBe(true);
    expect(membershipAllowsPlatformCredentials(owner, "wearer-1")).toBe(false);
    expect(
      membershipAllowsPlatformCredentials(
        {
          userId: "wearer-1",
          accessRole: "wearer",
          credentialSource: "platform_env",
          status: "active",
          persisted: true,
        },
        "wearer-1",
      ),
    ).toBe(false);
  });

  it("requires APP_OWNER_USER_ID to match in production", () => {
    process.env.APP_OWNER_USER_ID = "owner-1";
    expect(membershipAllowsPlatformCredentials(owner, "owner-1")).toBe(true);
    expect(
      membershipAllowsPlatformCredentials(
        { ...owner, userId: "other-owner" },
        "other-owner",
      ),
    ).toBe(false);
  });

  it("does not let a test wearer use platform keys", () => {
    process.env.APP_OWNER_USER_ID = "owner-1";
    expect(
      membershipAllowsPlatformCredentials(
        { ...owner, userId: "e2e-admin" },
        "e2e-admin",
      ),
    ).toBe(false);
  });
});

describe("email OTP sign-in users", () => {
  const originalOwnerId = process.env.APP_OWNER_USER_ID;

  beforeEach(() => {
    getSqlMock.mockReset();
    process.env.APP_OWNER_USER_ID = "owner-1";
  });

  afterEach(() => {
    if (originalOwnerId === undefined) {
      delete process.env.APP_OWNER_USER_ID;
    } else {
      process.env.APP_OWNER_USER_ID = originalOwnerId;
    }
  });

  it("a freshly created OTP user is un-invited: no owner, no platform credentials", async () => {
    getSqlMock.mockReturnValue(vi.fn().mockResolvedValue([]) as never);

    const policy = await getMembershipPolicy("otp-bot-user");
    expect(policy).toBeNull();
    expect(membershipAllowsPlatformCredentials(policy, "otp-bot-user")).toBe(
      false,
    );
    await expect(isOtpSignInBlockedForUser("otp-bot-user")).resolves.toBe(
      false,
    );
  });

  it("an invited OTP user is a BYOK wearer", async () => {
    getSqlMock.mockReturnValue(
      vi.fn().mockResolvedValue([
        {
          user_id: "otp-bot-user",
          access_role: "wearer",
          credential_source: "user_byok",
          status: "active",
        },
      ]) as never,
    );

    const policy = await getMembershipPolicy("otp-bot-user");
    expect(policy?.accessRole).toBe("wearer");
    expect(policy?.credentialSource).toBe("user_byok");
    expect(membershipAllowsPlatformCredentials(policy, "otp-bot-user")).toBe(
      false,
    );
    await expect(isOtpSignInBlockedForUser("otp-bot-user")).resolves.toBe(
      false,
    );
  });

  it("blocks OTP sign-in into the owner account", async () => {
    getSqlMock.mockReturnValue(vi.fn().mockResolvedValue([]) as never);
    await expect(isOtpSignInBlockedForUser("owner-1")).resolves.toBe(true);

    delete process.env.APP_OWNER_USER_ID;
    getSqlMock.mockReturnValue(
      vi.fn().mockResolvedValue([
        {
          user_id: "row-owner",
          access_role: "owner",
          credential_source: "platform_env",
          status: "active",
        },
      ]) as never,
    );
    await expect(isOtpSignInBlockedForUser("row-owner")).resolves.toBe(true);
  });

  it("fails closed when the membership store is unavailable", async () => {
    getSqlMock.mockReturnValue(
      vi.fn().mockRejectedValue(new Error("down")) as never,
    );
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(isOtpSignInBlockedForUser("otp-bot-user")).rejects.toThrow(
      MembershipStoreUnavailableError,
    );
    error.mockRestore();
  });
});

/**
 * Memory adapter whose next `failures.remaining` reads reject, to simulate a
 * transient database error during the guard's user or account lookup.
 */
function flakyMemoryAdapter(
  db: Record<string, unknown[]>,
  failures: { remaining: number },
) {
  const base = memoryAdapter(db);
  return (options: Parameters<typeof base>[0]) => {
    const adapter = base(options);
    const failIfArmed =
      <Args extends unknown[], Result>(fn: (...args: Args) => Promise<Result>) =>
      (...args: Args): Promise<Result> => {
        if (failures.remaining > 0) {
          failures.remaining -= 1;
          return Promise.reject(new Error("transient db error"));
        }
        return fn(...args);
      };
    return {
      ...adapter,
      findOne: failIfArmed(adapter.findOne),
      findMany: failIfArmed(adapter.findMany),
    };
  };
}

const AUTH_SECRET = "test-better-auth-secret-at-least-32-characters";

describe("createOtpOwnerGuardPlugin", () => {
  const originalOwnerId = process.env.APP_OWNER_USER_ID;

  beforeEach(() => {
    getSqlMock.mockReset();
    getSqlMock.mockReturnValue(vi.fn().mockResolvedValue([]) as never);
    resendSend.mockReset();
    resendSend.mockResolvedValue({ data: { id: "e" }, error: null });
  });

  afterEach(() => {
    if (originalOwnerId === undefined) {
      delete process.env.APP_OWNER_USER_ID;
    } else {
      process.env.APP_OWNER_USER_ID = originalOwnerId;
    }
  });

  function buildGuardedAuth(
    existingUserId?: string,
    linkedProvider?: string,
    failures?: { remaining: number },
  ) {
    const db: Record<string, unknown[]> = {
      user: existingUserId
        ? [
            {
              id: existingUserId,
              email: "bot@example.com",
              name: "Existing",
              emailVerified: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ]
        : [],
      session: [],
      account:
        existingUserId && linkedProvider
          ? [
              {
                id: "acct-1",
                userId: existingUserId,
                accountId: "provider-account-1",
                providerId: linkedProvider,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ]
          : [],
      verification: [],
    };
    const auth = betterAuth({
      baseURL: "http://localhost:3000",
      secret: AUTH_SECRET,
      database: failures
        ? flakyMemoryAdapter(db, failures)
        : memoryAdapter(db),
      plugins: [
        ...createEmailOtpPlugins(
          {
            allowlist: ["bot@example.com"],
            from: "auth@example.com",
            resendApiKey: "re_test",
          },
          "Project Blue Jeans",
          { logSecret: AUTH_SECRET },
        ),
        createOtpOwnerGuardPlugin({ logSecret: AUTH_SECRET }),
      ],
    });
    const post = (path: string, body: unknown) =>
      auth.handler(
        new Request(`http://localhost:3000/api/auth${path}`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3000",
          },
          body: JSON.stringify(body),
        }),
      );

    return { auth, post, db };
  }

  /**
   * Issues a valid code server-side (blocked accounts are never emailed one)
   * and tries to sign in with it.
   */
  async function signInWithCode(
    existingUserId?: string,
    signInEmail = "bot@example.com",
    linkedProvider?: string,
  ) {
    const { auth, post, db } = buildGuardedAuth(existingUserId, linkedProvider);
    const otp = await auth.api.createVerificationOTP({
      body: { email: "bot@example.com", type: "sign-in" },
    });
    const response = await post("/sign-in/email-otp", {
      email: signInEmail,
      otp,
    });
    return { response, db };
  }

  it("refuses email OTP sign-in into the owner account", async () => {
    process.env.APP_OWNER_USER_ID = "owner-1";

    const { response, db } = await signInWithCode("owner-1");

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "INVALID_OTP",
      message: "Invalid OTP",
    });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(db.session).toHaveLength(0);
  });

  it("refuses an owner email with surrounding whitespace as INVALID_OTP", async () => {
    process.env.APP_OWNER_USER_ID = "owner-1";

    const { response, db } = await signInWithCode("owner-1", "  bot@example.com  ");

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "INVALID_OTP",
      message: "Invalid OTP",
    });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(db.session).toHaveLength(0);
  });

  it("refuses email OTP sign-in into an account with a linked provider", async () => {
    process.env.APP_OWNER_USER_ID = "owner-1";

    const { response, db } = await signInWithCode(
      "member-1",
      "bot@example.com",
      "google",
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "INVALID_OTP" });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(db.session).toHaveLength(0);
  });

  it("emails no code to the owner and answers like an unlisted address", async () => {
    process.env.APP_OWNER_USER_ID = "owner-1";
    const { post, db } = buildGuardedAuth("owner-1");

    const owner = await post("/email-otp/send-verification-otp", {
      email: "bot@example.com",
      type: "sign-in",
    });
    expect(db.verification).toHaveLength(0);
    const unlisted = await post("/email-otp/send-verification-otp", {
      email: "intruder@example.com",
      type: "sign-in",
    });

    expect(resendSend).not.toHaveBeenCalled();
    expect(owner.status).toBe(unlisted.status);
    expect(await owner.json()).toEqual(await unlisted.json());
  });

  it("still emails a code to a code-only account", async () => {
    process.env.APP_OWNER_USER_ID = "owner-1";
    const { post } = buildGuardedAuth("bot-1");

    const response = await post("/email-otp/send-verification-otp", {
      email: "bot@example.com",
      type: "sign-in",
    });

    expect(response.status).toBe(200);
    expect(resendSend).toHaveBeenCalledTimes(1);
  });

  it("lets a new OTP user sign in without making it the owner", async () => {
    process.env.APP_OWNER_USER_ID = "owner-1";

    const { response, db } = await signInWithCode();

    expect(response.status).toBe(200);
    const user = db.user[0] as { id: string };
    expect(user.id).not.toBe("owner-1");
    const policy = await getMembershipPolicy(user.id);
    expect(policy).toBeNull();
    expect(membershipAllowsPlatformCredentials(policy, user.id)).toBe(false);
  });

  it("does not store a verification row for an unlisted address", async () => {
    const { post, db } = buildGuardedAuth();

    const response = await post("/email-otp/send-verification-otp", {
      email: "intruder@example.com",
      type: "sign-in",
    });

    expect(response.status).toBe(200);
    expect(db.verification).toHaveLength(0);
    expect(resendSend).not.toHaveBeenCalled();
  });

  it("lets a code-created user sign in again and still has no linked accounts", async () => {
    const { auth, post, db } = buildGuardedAuth();

    const firstOtp = await auth.api.createVerificationOTP({
      body: { email: "bot@example.com", type: "sign-in" },
    });
    const first = await post("/sign-in/email-otp", {
      email: "bot@example.com",
      otp: firstOtp,
    });
    expect(first.status).toBe(200);

    const secondOtp = await auth.api.createVerificationOTP({
      body: { email: "bot@example.com", type: "sign-in" },
    });
    const second = await post("/sign-in/email-otp", {
      email: "bot@example.com",
      otp: secondOtp,
    });

    expect(second.status).toBe(200);
    expect(db.user).toHaveLength(1);
    expect(db.account).toHaveLength(0);
  });

  it("fails sign-in closed when the membership store is down", async () => {
    const down = { value: false };
    getSqlMock.mockReturnValue(
      vi.fn(async () => {
        if (down.value) throw new Error("membership store down");
        return [];
      }) as never,
    );
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { auth, post, db } = buildGuardedAuth("bot-1");
    const otp = await auth.api.createVerificationOTP({
      body: { email: "bot@example.com", type: "sign-in" },
    });

    down.value = true;
    const response = await post("/sign-in/email-otp", {
      email: "bot@example.com",
      otp,
    });

    expect(response.status).not.toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(db.session).toHaveLength(0);
    error.mockRestore();
  });

  it("blocks a password-linked account as well as a Google-linked one", async () => {
    process.env.APP_OWNER_USER_ID = "owner-1";

    const { response, db } = await signInWithCode(
      "member-1",
      "bot@example.com",
      "credential",
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "INVALID_OTP" });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(db.session).toHaveLength(0);
  });

  it("succeeds when the lookup works on the second attempt", async () => {
    const failures = { remaining: 0 };
    const { auth, post, db } = buildGuardedAuth("bot-1", undefined, failures);
    const otp = await auth.api.createVerificationOTP({
      body: { email: "bot@example.com", type: "sign-in" },
    });
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    failures.remaining = 1;
    const response = await post("/sign-in/email-otp", {
      email: "bot@example.com",
      otp,
    });

    expect(response.status).toBe(200);
    expect(failures.remaining).toBe(0);
    expect(error).not.toHaveBeenCalledWith(
      "otp_guard_lookup_failed",
      expect.anything(),
    );
    expect(db.session).toHaveLength(1);
    error.mockRestore();
  });

  it("denies sign-in and logs otp_guard_lookup_failed after two failed lookups", async () => {
    const failures = { remaining: 0 };
    const { auth, post, db } = buildGuardedAuth("bot-1", undefined, failures);
    const otp = await auth.api.createVerificationOTP({
      body: { email: "bot@example.com", type: "sign-in" },
    });
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    failures.remaining = 2;
    const response = await post("/sign-in/email-otp", {
      email: "bot@example.com",
      otp,
    });

    expect(response.status).not.toBe(200);
    expect(failures.remaining).toBe(0);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(db.session).toHaveLength(0);
    expect(error).toHaveBeenCalledWith(
      "otp_guard_lookup_failed",
      expect.objectContaining({ attempts: 2 }),
    );
    const logged = JSON.stringify(error.mock.calls);
    expect(logged).not.toContain("bot@example.com");
    error.mockRestore();
  });
  it("answers a send lookup failure like an unlisted address, with no code and no raw email logged", async () => {
    const failures = { remaining: 0 };
    const { post, db } = buildGuardedAuth("bot-1", undefined, failures);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const unlisted = await post("/email-otp/send-verification-otp", {
      email: "intruder@example.com",
      type: "sign-in",
    });

    failures.remaining = 2;
    const failed = await post("/email-otp/send-verification-otp", {
      email: "bot@example.com",
      type: "sign-in",
    });

    expect(failed.status).toBe(unlisted.status);
    expect(await failed.json()).toEqual(await unlisted.json());
    expect(db.verification).toHaveLength(0);
    expect(resendSend).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      "otp_guard_lookup_failed",
      expect.objectContaining({
        attempts: 2,
        emailHash: otpEmailLogHash("bot@example.com", AUTH_SECRET),
      }),
    );
    const logged = JSON.stringify([...error.mock.calls, ...warn.mock.calls]);
    expect(logged).not.toContain("bot@example.com");
    error.mockRestore();
    warn.mockRestore();
  });

  it("answers a sign-in lookup failure with the same INVALID_OTP as a wrong code", async () => {
    const failures = { remaining: 0 };
    const { auth, post, db } = buildGuardedAuth("bot-1", undefined, failures);
    await auth.api.createVerificationOTP({
      body: { email: "bot@example.com", type: "sign-in" },
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const wrong = await post("/sign-in/email-otp", {
      email: "bot@example.com",
      otp: "000000",
    });
    const otp = await auth.api.createVerificationOTP({
      body: { email: "bot@example.com", type: "sign-in" },
    });
    failures.remaining = 2;
    const failed = await post("/sign-in/email-otp", {
      email: "bot@example.com",
      otp,
    });

    expect(failed.status).toBe(wrong.status);
    expect(await failed.json()).toEqual(await wrong.json());
    expect(failed.headers.get("set-cookie")).toBeNull();
    expect(db.session).toHaveLength(0);
    const logged = JSON.stringify([...error.mock.calls, ...warn.mock.calls]);
    expect(logged).not.toContain("bot@example.com");
    error.mockRestore();
    warn.mockRestore();
  });

  it("logs blocked owner sign-ins by reason and email hash, never the raw email", async () => {
    process.env.APP_OWNER_USER_ID = "owner-1";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { response } = await signInWithCode("owner-1");

    expect(response.status).toBe(400);
    expect(warn).toHaveBeenCalledWith(
      "otp_sign_in_failed",
      expect.objectContaining({
        reason: "otp_account_blocked",
        emailHash: otpEmailLogHash("bot@example.com", AUTH_SECRET),
      }),
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain("bot@example.com");
    warn.mockRestore();
  });
});
