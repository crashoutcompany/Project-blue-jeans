import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import { MembershipStoreUnavailableError } from "@/lib/auth/membership";
import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";

const getSqlMock = vi.mocked(getSql);
const getSession = vi.mocked(auth.getSession);

function emptySql() {
  return vi.fn().mockResolvedValue([]) as never;
}

describe("getMembershipPolicyForUser", () => {
  const originalOwnerId = process.env.APP_OWNER_USER_ID;
  const originalE2e = process.env.E2E_PLAYWRIGHT;

  beforeEach(() => {
    getSqlMock.mockReset();
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

  it("does not treat a signed-in admin as owner without APP_OWNER_USER_ID", async () => {
    getSqlMock.mockReturnValue(emptySql());

    await expect(
      getMembershipPolicyForUser({ id: "admin-1", role: "admin" }),
    ).resolves.toBeNull();
  });

  it("bootstraps only the configured APP_OWNER_USER_ID", async () => {
    process.env.APP_OWNER_USER_ID = "owner-1";
    getSqlMock.mockReturnValue(emptySql());

    await expect(
      getMembershipPolicyForUser({ id: "owner-1", role: "user" }),
    ).resolves.toEqual({
      userId: "owner-1",
      accessRole: "owner",
      credentialSource: "platform_env",
      status: "active",
      persisted: false,
    });
    await expect(
      getMembershipPolicyForUser({ id: "admin-1", role: "admin" }),
    ).resolves.toBeNull();
  });

  it("lets the Playwright admin cookie bootstrap while E2E_PLAYWRIGHT=1", async () => {
    process.env.E2E_PLAYWRIGHT = "1";
    getSqlMock.mockReturnValue(emptySql());

    await expect(
      getMembershipPolicyForUser({ id: "e2e-admin", role: "admin" }),
    ).resolves.toEqual({
      userId: "e2e-admin",
      accessRole: "owner",
      credentialSource: "platform_env",
      status: "active",
      persisted: false,
    });
  });

  it("does not admit a non-admin without a membership row", async () => {
    getSqlMock.mockReturnValue(emptySql());

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
  const originalOwnerId = process.env.APP_OWNER_USER_ID;
  const originalE2e = process.env.E2E_PLAYWRIGHT;

  beforeEach(() => {
    getSession.mockReset();
    getSqlMock.mockReset();
    getSqlMock.mockReturnValue(undefined);
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

  it("returns ok when APP_OWNER_USER_ID bootstrap applies", async () => {
    process.env.APP_OWNER_USER_ID = "u1";
    getSession.mockResolvedValue({
      data: { user: { id: "u1", email: "a@x.com", role: "user" } },
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

  it("returns 503 when the membership store cannot be queried", async () => {
    getSqlMock.mockReturnValue(
      vi.fn().mockRejectedValueOnce(new Error("db down")) as never,
    );
    getSession.mockResolvedValue({
      data: { user: { id: "u1", email: "a@x.com", role: "admin" } },
    });
    await expect(assertAdmittedForServerAction()).resolves.toEqual({
      ok: false,
      message: "Could not verify admission. Try again.",
    });
  });
});

describe("requireAdmittedAccess", () => {
  const originalOwnerId = process.env.APP_OWNER_USER_ID;
  const originalE2e = process.env.E2E_PLAYWRIGHT;

  beforeEach(() => {
    getSession.mockReset();
    getSqlMock.mockReset();
    getSqlMock.mockReturnValue(undefined);
    vi.mocked(redirect).mockClear();
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

  it("does not admit a Neon admin without APP_OWNER_USER_ID", async () => {
    getSession.mockResolvedValue({
      data: { user: { id: "u1", email: "a@x.com", role: "admin" } },
    });
    await expect(requireAdmittedAccess()).rejects.toThrowError(
      /REDIRECT:\/auth\/accept-invite/,
    );
  });

  it("resolves when APP_OWNER_USER_ID bootstrap applies", async () => {
    process.env.APP_OWNER_USER_ID = "u1";
    getSession.mockResolvedValue({
      data: { user: { id: "u1", email: "a@x.com", role: "user" } },
    });
    await expect(requireAdmittedAccess()).resolves.toBeUndefined();
  });

  it("throws when the membership store is unavailable", async () => {
    getSqlMock.mockReturnValue(
      vi.fn().mockRejectedValueOnce(new Error("db down")) as never,
    );
    getSession.mockResolvedValue({
      data: { user: { id: "u1", email: "a@x.com", role: "admin" } },
    });
    await expect(requireAdmittedAccess()).rejects.toBeInstanceOf(
      MembershipStoreUnavailableError,
    );
  });
});
