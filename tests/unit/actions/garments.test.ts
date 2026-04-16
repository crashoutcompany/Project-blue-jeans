import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({
  auth: {
    getSession: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  requireSql: vi.fn(),
}));

import { auth } from "@/lib/auth/server";
import { requireSql } from "@/lib/db";
import { toggleGarmentFavorite } from "@/app/actions/garments";

const getSession = vi.mocked(auth.getSession);
const requireSqlMock = vi.mocked(requireSql);

describe("toggleGarmentFavorite", () => {
  beforeEach(() => {
    getSession.mockReset();
    requireSqlMock.mockReset();
  });

  it("returns error when not admin", async () => {
    getSession.mockResolvedValue({
      data: { user: { email: "u@x.com", role: "user" } },
    });
    const res = await toggleGarmentFavorite("x");
    expect(res.ok).toBe(false);
  });

  it("updates and returns ok", async () => {
    getSession.mockResolvedValue({
      data: { user: { email: "a@x.com", role: "admin" } },
    });
    const sql = vi.fn().mockResolvedValue(undefined);
    requireSqlMock.mockReturnValue(sql as never);
    const res = await toggleGarmentFavorite("f47ac10b-58cc-4372-a567-0e02b2c3d479");
    expect(res.ok).toBe(true);
    expect(sql).toHaveBeenCalled();
  });
});
