import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import {
  assertAdminForServerAction,
  isAdminUser,
  redirectSignedInNonAdminFromPublicPage,
  requireAdminAccess,
} from "@/lib/auth/admin";

vi.mock("@/lib/auth/server", () => ({
  auth: {
    getSession: vi.fn(),
  },
}));

const getSession = vi.mocked(auth.getSession);

describe("isAdminUser", () => {
  const prev = process.env.APP_ADMIN_EMAILS;

  afterEach(() => {
    process.env.APP_ADMIN_EMAILS = prev;
  });

  it("returns true when role is admin", () => {
    expect(isAdminUser({ role: "admin", email: "x@y.com" })).toBe(true);
  });

  it("returns true when email is in APP_ADMIN_EMAILS (case-insensitive)", () => {
    process.env.APP_ADMIN_EMAILS = "Admin@Test.com, other@x.com";
    expect(isAdminUser({ role: "user", email: "admin@test.com" })).toBe(true);
  });

  it("returns false for null and non-admin without allowlist", () => {
    process.env.APP_ADMIN_EMAILS = "";
    expect(isAdminUser(null)).toBe(false);
    expect(isAdminUser({ role: "user", email: "nope@x.com" })).toBe(false);
  });
});

describe("assertAdminForServerAction", () => {
  beforeEach(() => {
    getSession.mockReset();
  });

  it("returns sign-in message when no user", async () => {
    getSession.mockResolvedValue({ data: null });
    await expect(assertAdminForServerAction()).resolves.toEqual({
      ok: false,
      message: "Sign in to continue.",
    });
  });

  it("returns admin required when not admin", async () => {
    getSession.mockResolvedValue({
      data: { user: { email: "u@x.com", role: "user" } },
    });
    await expect(assertAdminForServerAction()).resolves.toEqual({
      ok: false,
      message:
        "Admin access is required. Sign out and use an admin account.",
    });
  });

  it("returns ok when admin by role", async () => {
    getSession.mockResolvedValue({
      data: { user: { email: "a@x.com", role: "admin" } },
    });
    await expect(assertAdminForServerAction()).resolves.toEqual({ ok: true });
  });
});

describe("requireAdminAccess", () => {
  beforeEach(() => {
    getSession.mockReset();
    vi.mocked(redirect).mockClear();
  });

  it("redirects to sign-in when no user", async () => {
    getSession.mockResolvedValue({ data: null });
    await expect(requireAdminAccess()).rejects.toThrowError(
      /REDIRECT:\/auth\/sign-in/,
    );
  });

  it("redirects to not-admin when signed in but not admin", async () => {
    getSession.mockResolvedValue({
      data: { user: { email: "u@x.com", role: "user" } },
    });
    await expect(requireAdminAccess()).rejects.toThrowError(
      /REDIRECT:\/auth\/not-admin/,
    );
  });

  it("resolves when admin", async () => {
    getSession.mockResolvedValue({
      data: { user: { email: "a@x.com", role: "admin" } },
    });
    await expect(requireAdminAccess()).resolves.toBeUndefined();
  });
});

describe("redirectSignedInNonAdminFromPublicPage", () => {
  beforeEach(() => {
    getSession.mockReset();
    vi.mocked(redirect).mockClear();
  });

  it("redirects non-admin signed-in users", async () => {
    getSession.mockResolvedValue({
      data: { user: { email: "u@x.com", role: "user" } },
    });
    await expect(redirectSignedInNonAdminFromPublicPage()).rejects.toThrowError(
      /REDIRECT:\/auth\/not-admin/,
    );
  });

  it("does not redirect when anon", async () => {
    getSession.mockResolvedValue({ data: null });
    await expect(redirectSignedInNonAdminFromPublicPage()).resolves.toBeUndefined();
  });

  it("does not redirect when admin", async () => {
    getSession.mockResolvedValue({
      data: { user: { email: "a@x.com", role: "admin" } },
    });
    await expect(redirectSignedInNonAdminFromPublicPage()).resolves.toBeUndefined();
  });
});
