import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mergedMock = vi.fn((r: NextRequest) => r);

vi.mock("@/lib/auth/neon-dev-request-cookies", () => ({
  nextRequestWithMergedCookieHeader: (r: NextRequest) => mergedMock(r),
}));

const neonMw = vi.fn(async (req: NextRequest) =>
  NextResponse.next({ status: 418, request: { headers: req.headers } }),
);

vi.mock("@/lib/auth/server", () => ({
  auth: {
    middleware: vi.fn(() => neonMw),
  },
}));

describe("proxy", () => {
  beforeEach(() => {
    vi.resetModules();
    mergedMock.mockImplementation((r) => r);
    neonMw.mockClear();
    vi.unstubAllEnvs();
  });

  it("bypasses auth middleware for /", async () => {
    const { proxy } = await import("@/proxy");
    const req = new NextRequest("https://example.com/");
    const res = await proxy(req);
    expect(res.status).toBe(200);
    expect(neonMw).not.toHaveBeenCalled();
  });

  it("does not run Neon auth middleware for /api/* but merges cookies", async () => {
    const { proxy } = await import("@/proxy");
    const req = new NextRequest("https://example.com/api/foo");
    const res = await proxy(req);
    expect(neonMw).not.toHaveBeenCalled();
    expect(mergedMock).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("runs Neon auth middleware for non-api routes", async () => {
    const { proxy } = await import("@/proxy");
    const req = new NextRequest("https://example.com/dashboard");
    const res = await proxy(req);
    expect(neonMw).toHaveBeenCalled();
    expect(res.status).toBe(418);
  });

  // Note: 127.0.0.1 → localhost redirect uses NODE_ENV === "development";
  // Vitest workers typically fix NODE_ENV to "test", so that branch is not exercised here.
});
