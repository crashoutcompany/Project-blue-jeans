import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  getSql: vi.fn(),
  requireSql: vi.fn(),
}));

import {
  getMembershipPolicy,
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
});
