import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  getSql: vi.fn(),
  requireSql: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  auth: { getSession: vi.fn() },
}));

import { redirect } from "next/navigation";

import {
  assertAdmittedForServerAction,
  getMembershipPolicyForUser,
  requireAdmittedAccess,
} from "@/lib/auth/admitted";
import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";

const getSqlMock = vi.mocked(getSql);
const getSession = vi.mocked(auth.getSession);

describe("getMembershipPolicyForUser", () => {
  beforeEach(() => {
    getSqlMock.mockReset();
    delete process.env.APP_OWNER_USER_ID;
  });

  it("treats a signed-in admin without a row as the platform-funded owner", async () => {
    getSqlMock.mockReturnValue(vi.fn().mockResolvedValueOnce([]) as never);

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
    getSqlMock.mockReturnValue(vi.fn().mockResolvedValueOnce([]) as never);

    await expect(
      getMembershipPolicyForUser({ id: "wearer-1", role: "user" }),
    ).resolves.toBeNull();
  });

  it("admits an admin when the database is unset", async () => {
    getSqlMock.mockReturnValue(undefined);

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

  it("returns a persisted wearer membership", async () => {
    getSqlMock.mockReturnValue(
      vi.fn().mockResolvedValueOnce([
        {
          user_id: "wearer-1",
          access_role: "wearer",
          credential_source: "user_byok",
          status: "active",
        },
      ]) as never,
    );

    await expect(
      getMembershipPolicyForUser({ id: "wearer-1", role: "user" }),
    ).resolves.toEqual({
      userId: "wearer-1",
      accessRole: "wearer",
      credentialSource: "user_byok",
      status: "active",
      persisted: true,
    });
  });
});

describe("assertAdmittedForServerAction", () => {
  beforeEach(() => {
    getSession.mockReset();
    getSqlMock.mockReset();
    getSqlMock.mockReturnValue(undefined);
  });

  it("returns sign-in message when no user", async () => {
    getSession.mockResolvedValue({ data: null });
    await expect(assertAdmittedForServerAction()).resolves.toEqual({
      ok: false,
      message: "Sign in to continue.",
    });
  });

  it("returns not admitted when signed in without membership", async () => {
    getSession.mockResolvedValue({
      data: { user: { id: "u1", email: "u@x.com", role: "user" } },
    });
    await expect(assertAdmittedForServerAction()).resolves.toEqual({
      ok: false,
      message: "This account has not been admitted to Blue Jeans.",
    });
  });

  it("returns ok when admin bootstrap applies", async () => {
    getSession.mockResolvedValue({
      data: { user: { id: "u1", email: "a@x.com", role: "admin" } },
    });
    await expect(assertAdmittedForServerAction()).resolves.toEqual({
      ok: true,
      userId: "u1",
      membership: {
        userId: "u1",
        accessRole: "owner",
        credentialSource: "platform_env",
        status: "active",
        persisted: false,
      },
    });
  });
});

describe("requireAdmittedAccess", () => {
  beforeEach(() => {
    getSession.mockReset();
    getSqlMock.mockReset();
    getSqlMock.mockReturnValue(undefined);
    vi.mocked(redirect).mockClear();
  });

  it("redirects to sign-in when no user", async () => {
    getSession.mockResolvedValue({ data: null });
    await expect(requireAdmittedAccess()).rejects.toThrowError(
      /REDIRECT:\/auth\/sign-in/,
    );
  });

  it("redirects to accept-invite when signed in but not admitted", async () => {
    getSession.mockResolvedValue({
      data: { user: { id: "u1", email: "u@x.com", role: "user" } },
    });
    await expect(requireAdmittedAccess()).rejects.toThrowError(
      /REDIRECT:\/auth\/accept-invite/,
    );
  });

  it("resolves when admin bootstrap applies", async () => {
    getSession.mockResolvedValue({
      data: { user: { id: "u1", email: "a@x.com", role: "admin" } },
    });
    await expect(requireAdmittedAccess()).resolves.toBeUndefined();
  });
});
