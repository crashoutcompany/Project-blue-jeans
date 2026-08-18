import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, connection: vi.fn() };
});

vi.mock("@/lib/auth/admitted", () => ({
  assertAdmittedSession: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  auth: { getSession: vi.fn() },
}));

vi.mock("@/lib/auth/invites", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/invites")>();
  return {
    ...actual,
    acceptInviteToken: vi.fn(),
  };
});

import { assertAdmittedSession } from "@/lib/auth/admitted";
import { auth } from "@/lib/auth/server";
import { PENDING_INVITE_COOKIE } from "@/lib/auth/invites";
import { GET } from "@/app/invite/[token]/route";

const admitted = vi.mocked(assertAdmittedSession);
const getSession = vi.mocked(auth.getSession);

describe("GET /invite/[token]", () => {
  beforeEach(() => {
    admitted.mockReset();
    getSession.mockReset();
  });

  it("stores the invite on the redirect when the Wearer is signed out", async () => {
    admitted.mockResolvedValue({
      ok: false,
      status: 401,
      message: "Sign in to continue.",
    });
    getSession.mockResolvedValue({ data: null });

    const res = await GET(new Request("https://jeans.test/invite/tok-1"), {
      params: Promise.resolve({ token: "tok-1" }),
    });

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://jeans.test/auth/sign-in");
    expect(res.cookies.get(PENDING_INVITE_COOKIE)?.value).toBe("tok-1");
  });
});
