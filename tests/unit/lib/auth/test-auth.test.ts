import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: {} }));
vi.mock("@/lib/db", () => ({ getSql: vi.fn() }));

import {
  isTestAuthEnabled,
  isValidTestAuthSecret,
} from "@/lib/auth/test-auth";

describe("test auth guards", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "development",
      TEST_AUTH_SECRET: "test-secret",
    };
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("allows local development and explicit local E2E builds", () => {
    expect(isTestAuthEnabled()).toBe(true);
    process.env.NODE_ENV = "production";
    process.env.EXPOSE_TESTING_API = "1";
    expect(isTestAuthEnabled()).toBe(true);
  });

  it("fails closed in production and on unknown Vercel environments", () => {
    process.env.VERCEL_ENV = "production";
    expect(isTestAuthEnabled()).toBe(false);
    delete process.env.VERCEL_ENV;
    process.env.VERCEL = "1";
    expect(isTestAuthEnabled()).toBe(false);
  });

  it("compares the configured secret", () => {
    expect(isValidTestAuthSecret("test-secret")).toBe(true);
    expect(isValidTestAuthSecret("wrong")).toBe(false);
    expect(isValidTestAuthSecret(null)).toBe(false);
  });
});
