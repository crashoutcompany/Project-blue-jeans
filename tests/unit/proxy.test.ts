import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getSession } = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession } },
}));

import { proxy } from "@/proxy";

/**
 * App route config only. Session refresh and header forwarding live in
 * `lib/auth/proxy.test.ts`.
 */
describe("proxy", () => {
  beforeEach(() => {
    getSession.mockReset();
  });

  function mockSession(signedIn: boolean) {
    getSession.mockResolvedValue({
      headers: new Headers(),
      response: signedIn ? { user: { id: "u1" } } : null,
    });
  }

  it.each(["/", "/privacy", "/terms", "/invite/token", "/auth/not-admitted"])(
    "serves public path %s without loading a session",
    async (path) => {
      const response = await proxy(
        new NextRequest(`https://example.com${path}`),
      );
      expect(response.status).toBe(200);
      expect(getSession).not.toHaveBeenCalled();
    },
  );

  it.each(["/closet", "/calendar", "/settings"])(
    "redirects a guest from %s to sign-in",
    async (path) => {
      mockSession(false);
      const response = await proxy(
        new NextRequest(`https://example.com${path}`),
      );
      expect(response.headers.get("location")).toBe(
        "https://example.com/signin",
      );
    },
  );

  it("lets a signed-in user through a gated path", async () => {
    mockSession(true);
    const response = await proxy(new NextRequest("https://example.com/closet"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("sends a signed-in user from sign-in to Today", async () => {
    mockSession(true);
    const response = await proxy(new NextRequest("https://example.com/signin"));
    expect(response.headers.get("location")).toBe("https://example.com/");
  });
});
