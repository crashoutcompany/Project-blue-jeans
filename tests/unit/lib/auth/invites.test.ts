import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  requireSql: vi.fn(),
  getSql: vi.fn(),
}));

import {
  acceptInviteToken,
  createWearerInvite,
  hashInviteToken,
  normalizeInviteEmail,
  sessionEmailOf,
} from "@/lib/auth/invites";
import { requireSql } from "@/lib/db";

const requireSqlMock = vi.mocked(requireSql);

const owner = {
  userId: "owner-1",
  accessRole: "owner" as const,
  credentialSource: "platform_env" as const,
  status: "active" as const,
  persisted: true,
};

describe("invite helpers", () => {
  it("normalizes email", () => {
    expect(normalizeInviteEmail("  A@B.Com ")).toBe("a@b.com");
  });

  it("hashes tokens stably", () => {
    expect(hashInviteToken("abc")).toBe(hashInviteToken("abc"));
    expect(hashInviteToken("abc")).not.toBe(hashInviteToken("abd"));
  });

  it("reads session email", () => {
    expect(sessionEmailOf({ email: "  A@B.com " })).toBe("a@b.com");
    expect(sessionEmailOf({ id: "u1" })).toBeNull();
  });
});

describe("createWearerInvite", () => {
  beforeEach(() => {
    requireSqlMock.mockReset();
  });

  it("rejects non-owners", async () => {
    await expect(
      createWearerInvite({
        owner: { ...owner, accessRole: "wearer", credentialSource: "user_byok" },
        email: "a@b.com",
      }),
    ).resolves.toEqual({
      ok: false,
      message: "Only the owner can invite Wearers.",
    });
  });

  it("rejects invalid email", async () => {
    await expect(
      createWearerInvite({ owner, email: "not-an-email" }),
    ).resolves.toEqual({ ok: false, message: "Enter an email address." });
  });

  it("inserts a hashed token and returns the raw token once", async () => {
    const sql = vi.fn().mockResolvedValue(undefined);
    requireSqlMock.mockReturnValue(sql as never);
    const result = await createWearerInvite({ owner, email: " Wearer@X.com " });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.email).toBe("wearer@x.com");
    expect(result.token.length).toBeGreaterThan(20);
    expect(sql).toHaveBeenCalled();
  });
});

describe("acceptInviteToken", () => {
  beforeEach(() => {
    requireSqlMock.mockReset();
  });

  it("rejects unknown tokens", async () => {
    const sql = vi.fn().mockResolvedValue([]);
    requireSqlMock.mockReturnValue(sql as never);
    await expect(
      acceptInviteToken({
        userId: "u1",
        email: "a@b.com",
        token: "missing",
      }),
    ).resolves.toEqual({
      ok: false,
      message: "That invite has expired or already been used.",
    });
  });

  it("rejects email mismatch", async () => {
    const sql = vi.fn().mockResolvedValue([
      { id: "inv-1", email_normalized: "a@b.com" },
    ]);
    requireSqlMock.mockReturnValue(sql as never);
    await expect(
      acceptInviteToken({
        userId: "u1",
        email: "other@b.com",
        token: "tok",
      }),
    ).resolves.toEqual({
      ok: false,
      message: "Sign in with the email this invite was sent to.",
    });
  });

  it("inserts wearer membership and binds the invite", async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ id: "inv-1", email_normalized: "a@b.com" }])
      .mockResolvedValue(undefined);
    requireSqlMock.mockReturnValue(sql as never);
    await expect(
      acceptInviteToken({ userId: "u1", email: "A@B.com", token: "tok" }),
    ).resolves.toEqual({ ok: true });
    expect(sql).toHaveBeenCalledTimes(3);
  });
});
