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

import { createEmailOtpPlugins } from "@/lib/auth/email-otp";
import {
  getMembershipPolicy,
  isOtpSignInBlockedForUser,
  otpOwnerGuardPlugin,
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

describe("otpOwnerGuardPlugin", () => {
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

  async function signInWithCode(existingUserId?: string) {
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
      account: [],
      verification: [],
    };
    const auth = betterAuth({
      baseURL: "http://localhost:3000",
      secret: "test-better-auth-secret-at-least-32-characters",
      database: memoryAdapter(db),
      plugins: [
        ...createEmailOtpPlugins(
          {
            allowlist: ["bot@example.com"],
            from: "auth@example.com",
            resendApiKey: "re_test",
          },
          "Project Blue Jeans",
        ),
        otpOwnerGuardPlugin,
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

    await post("/email-otp/send-verification-otp", {
      email: "bot@example.com",
      type: "sign-in",
    });
    const otp = (resendSend.mock.calls[0]?.[0].text as string).match(
      /\b(\d{6})\b/,
    )?.[1];
    const response = await post("/sign-in/email-otp", {
      email: "bot@example.com",
      otp,
    });
    return { response, db };
  }

  it("refuses email OTP sign-in into the owner account", async () => {
    process.env.APP_OWNER_USER_ID = "owner-1";

    const { response, db } = await signInWithCode("owner-1");

    expect(response.status).toBe(403);
    expect(db.session).toHaveLength(0);
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
});
