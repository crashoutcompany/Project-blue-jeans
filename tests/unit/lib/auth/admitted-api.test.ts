import { describe, expect, it } from "vitest";

import { admittedRequiredJsonResponse } from "@/lib/auth/admitted-api";

describe("admitted-api", () => {
  it("returns 403 JSON with the default message", async () => {
    const res = admittedRequiredJsonResponse();
    expect(res.status).toBe(403);
    const body = (await res.json()) as { ok: boolean; message: string };
    expect(body.ok).toBe(false);
    expect(body.message).toContain("admitted");
  });
});
