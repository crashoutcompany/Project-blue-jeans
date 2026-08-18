import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  requireSql: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  auth: { getSession: vi.fn() },
}));

import { getMembershipPolicyForUser } from "@/lib/auth/admitted";
import { requireSql } from "@/lib/db";

const requireSqlMock = vi.mocked(requireSql);

describe("getMembershipPolicyForUser", () => {
  beforeEach(() => {
    requireSqlMock.mockReset();
    delete process.env.APP_OWNER_USER_ID;
  });

  it("treats a signed-in admin without a row as the platform-funded owner", async () => {
    requireSqlMock.mockReturnValue(vi.fn().mockResolvedValueOnce([]) as never);

    await expect(
      getMembershipPolicyForUser({ id: "admin-1", role: "admin" }),
    ).resolves.toEqual({
      userId: "admin-1",
      accessRole: "owner",
      credentialSource: "platform_env",
      status: "active",
      persisted: false,
    });
  });

  it("does not admit a non-admin without a membership row", async () => {
    requireSqlMock.mockReturnValue(vi.fn().mockResolvedValueOnce([]) as never);

    await expect(
      getMembershipPolicyForUser({ id: "wearer-1", role: "user" }),
    ).resolves.toBeNull();
  });
});
