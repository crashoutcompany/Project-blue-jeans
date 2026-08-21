import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  getSql: vi.fn(),
  requireSql: vi.fn(),
}));

import {
  getMembershipPolicy,
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

  it("returns null for a row with an unknown access role", async () => {
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

    await expect(getMembershipPolicy("wearer-1")).resolves.toBeNull();
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
  const originalE2e = process.env.E2E_PLAYWRIGHT;

  beforeEach(() => {
    delete process.env.APP_OWNER_USER_ID;
    delete process.env.E2E_PLAYWRIGHT;
  });

  afterEach(() => {
    if (originalOwnerId === undefined) {
      delete process.env.APP_OWNER_USER_ID;
    } else {
      process.env.APP_OWNER_USER_ID = originalOwnerId;
    }
    if (originalE2e === undefined) {
      delete process.env.E2E_PLAYWRIGHT;
    } else {
      process.env.E2E_PLAYWRIGHT = originalE2e;
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

  it("lets the Playwright harness owner use platform keys", () => {
    process.env.APP_OWNER_USER_ID = "owner-1";
    process.env.E2E_PLAYWRIGHT = "1";
    expect(
      membershipAllowsPlatformCredentials(
        { ...owner, userId: "e2e-admin" },
        "e2e-admin",
      ),
    ).toBe(true);
  });
});
