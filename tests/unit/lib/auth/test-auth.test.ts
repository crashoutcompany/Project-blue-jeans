import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: {} }));
vi.mock("@/lib/db", () => ({ getSql: vi.fn() }));

import {
  evaluateTestAuthRequest,
  isTestAuthEnabled,
  isValidTestAuthSecret,
  TEST_AUTH_HEADER,
} from "@/lib/auth/test-auth";

describe("test auth guards (shared:test-auth v2)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      EXPOSE_TESTING_API: "1",
      TEST_AUTH_SECRET: "test-secret",
    };
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("is enabled for an explicitly exposed local build", () => {
    expect(isTestAuthEnabled()).toBe(true);
  });

  it.each([
    ["the expose flag is absent", { EXPOSE_TESTING_API: undefined }],
    [
      "NODE_ENV is development but expose is absent",
      { NODE_ENV: "development", EXPOSE_TESTING_API: undefined },
    ],
    ["Vercel preview without expose", { VERCEL_ENV: "preview", EXPOSE_TESTING_API: undefined }],
    ["the app is running on Vercel", { VERCEL: "1" }],
    ["the deployment is production", { VERCEL_ENV: "production" }],
  ])("is disabled when %s", (_label, overrides) => {
    Object.assign(process.env, overrides);
    expect(isTestAuthEnabled()).toBe(false);
  });

  it("compares the configured secret", () => {
    expect(isValidTestAuthSecret("test-secret")).toBe(true);
    expect(isValidTestAuthSecret("wrong")).toBe(false);
    expect(isValidTestAuthSecret(null)).toBe(false);
  });

  it("allows a matching x-test-auth-secret header", () => {
    expect(evaluateTestAuthRequest("test-secret")).toEqual({ allow: true });
    expect(evaluateTestAuthRequest("wrong")).toEqual({
      allow: false,
      status: 401,
    });
    expect(TEST_AUTH_HEADER).toBe("x-test-auth-secret");
  });

  it("404s when the testing API is not exposed", () => {
    delete process.env.EXPOSE_TESTING_API;
    expect(evaluateTestAuthRequest("test-secret")).toEqual({
      allow: false,
      status: 404,
    });
  });
});
