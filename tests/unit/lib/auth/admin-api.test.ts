import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({
  auth: {
    getSession: vi.fn(),
  },
}));

import {
  adminRequiredJsonResponse,
  sessionAllowsAdminApi,
} from "@/lib/auth/admin-api";

describe("admin-api", () => {
  it("sessionAllowsAdminApi mirrors isAdminUser", () => {
    expect(sessionAllowsAdminApi({ role: "admin" })).toBe(true);
    expect(sessionAllowsAdminApi({ role: "user", email: "a@b.com" })).toBe(
      false,
    );
    expect(sessionAllowsAdminApi(null)).toBe(false);
  });

  it("adminRequiredJsonResponse returns 403 JSON", async () => {
    const res = adminRequiredJsonResponse();
    expect(res.status).toBe(403);
    const body = (await res.json()) as { ok: boolean; message: string };
    expect(body.ok).toBe(false);
    expect(body.message).toContain("Admin access");
  });
});
