import { afterEach, describe, expect, it } from "vitest";

import { authorizeCronRequest } from "@/lib/cron/authorize";

describe("authorizeCronRequest", () => {
  const original = process.env.CRON_SECRET;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = original;
    }
  });

  it("rejects when CRON_SECRET is unset", () => {
    delete process.env.CRON_SECRET;
    const req = new Request("http://localhost/api/cron/purge-stale-fits", {
      headers: { authorization: "Bearer anything" },
    });
    expect(authorizeCronRequest(req)).toBe(false);
  });

  it("accepts a matching Bearer token", () => {
    process.env.CRON_SECRET = "cron-secret-value";
    const req = new Request("http://localhost/api/cron/purge-stale-fits", {
      headers: { authorization: "Bearer cron-secret-value" },
    });
    expect(authorizeCronRequest(req)).toBe(true);
  });

  it("rejects a mismatched token", () => {
    process.env.CRON_SECRET = "cron-secret-value";
    const req = new Request("http://localhost/api/cron/purge-stale-fits", {
      headers: { authorization: "Bearer other" },
    });
    expect(authorizeCronRequest(req)).toBe(false);
  });
});
