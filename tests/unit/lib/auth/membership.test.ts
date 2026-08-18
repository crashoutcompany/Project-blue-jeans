import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  requireSql: vi.fn(),
}));

import { getMembershipPolicy } from "@/lib/auth/membership";
import { requireSql } from "@/lib/db";

const requireSqlMock = vi.mocked(requireSql);

describe("membership policy", () => {
  const originalOwnerId = process.env.APP_OWNER_USER_ID;

  beforeEach(() => {
    requireSqlMock.mockReset();
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
    requireSqlMock.mockReturnValue(
      vi.fn().mockResolvedValueOnce([]) as never,
    );

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
    requireSqlMock.mockReturnValue(
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
});
