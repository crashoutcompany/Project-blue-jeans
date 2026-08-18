import { afterEach, describe, expect, it } from "vitest";

import { isAdminUser } from "@/lib/auth/admin";

describe("isAdminUser", () => {
  const prev = process.env.APP_ADMIN_EMAILS;

  afterEach(() => {
    if (prev === undefined) {
      delete process.env.APP_ADMIN_EMAILS;
    } else {
      process.env.APP_ADMIN_EMAILS = prev;
    }
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
