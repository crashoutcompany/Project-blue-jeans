import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

describe("wireNeonCookieHeaderForUpstream", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("rewrites neon-auth. prefix to __Secure-neon-auth. in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { wireNeonCookieHeaderForUpstream } =
      await import("@/lib/auth/neon-dev-request-cookies");
    const out = wireNeonCookieHeaderForUpstream(
      "neon-auth.session=abc; other=1",
    );
    expect(out).toContain("__Secure-neon-auth.session=abc");
    expect(out).toContain("other=1");
  });

  it("is a no-op when not development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { wireNeonCookieHeaderForUpstream } =
      await import("@/lib/auth/neon-dev-request-cookies");
    const raw = "neon-auth.session=abc";
    expect(wireNeonCookieHeaderForUpstream(raw)).toBe(raw);
  });
});

describe("nextRequestWithMergedCookieHeader", () => {
  it("preserves existing Cookie header", async () => {
    const { nextRequestWithMergedCookieHeader } =
      await import("@/lib/auth/neon-dev-request-cookies");
    const req = new NextRequest("https://example.com/foo", {
      headers: { cookie: "session=abc" },
    });
    const merged = nextRequestWithMergedCookieHeader(req);
    expect(merged.headers.get("cookie")).toContain("session=abc");
  });
});
