import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getSession } = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession } },
}));

import { proxy } from "@/proxy";

describe("proxy", () => {
  beforeEach(() => {
    getSession.mockReset();
  });

  it.each(["/", "/privacy", "/terms", "/invite/token"])(
    "does not load a session for public path %s",
    async (path) => {
      const response = await proxy(
        new NextRequest(`https://example.com${path}`),
      );
      expect(response.status).toBe(200);
      expect(getSession).not.toHaveBeenCalled();
    },
  );

  it("checks sign-in and redirects an existing session", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    const request = new NextRequest("https://example.com/signin");
    const response = await proxy(request);

    expect(getSession).toHaveBeenCalledWith({ headers: request.headers });
    expect(response.headers.get("location")).toBe("https://example.com/");
  });

  it("redirects a guest from a gated path", async () => {
    getSession.mockResolvedValue(null);
    const request = new NextRequest("https://example.com/closet");
    const response = await proxy(request);

    expect(getSession).toHaveBeenCalledWith({ headers: request.headers });
    expect(response.headers.get("location")).toBe(
      "https://example.com/signin",
    );
  });

  it("allows a signed-in user through a gated path", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    const response = await proxy(
      new NextRequest("https://example.com/closet"),
    );
    expect(response.status).toBe(200);
  });
});
