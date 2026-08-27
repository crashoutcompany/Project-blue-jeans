import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({
  auth: {
    getSession: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  requireSql: vi.fn(),
  getSql: vi.fn(),
}));

import { auth } from "@/lib/auth/server";
import { getSql, requireSql } from "@/lib/db";
import { toggleGarmentFavorite } from "@/app/actions/garments";

const getSession = vi.mocked(auth.getSession);
const requireSqlMock = vi.mocked(requireSql);

describe("toggleGarmentFavorite", () => {
  const originalOwnerId = process.env.APP_OWNER_USER_ID;
  const garmentId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  beforeEach(() => {
    getSession.mockReset();
    requireSqlMock.mockReset();
    vi.mocked(getSql).mockReset();
    vi.mocked(getSql).mockReturnValue(undefined);
    delete process.env.APP_OWNER_USER_ID;
  });

  afterEach(() => {
    if (originalOwnerId === undefined) {
      delete process.env.APP_OWNER_USER_ID;
    } else {
      process.env.APP_OWNER_USER_ID = originalOwnerId;
    }
  });

  it("returns error when not admitted", async () => {
    getSession.mockResolvedValue({
      data: { user: { email: "u@x.com", role: "user" } },
    });
    const res = await toggleGarmentFavorite("x");
    expect(res.ok).toBe(false);
  });

  it("updates and returns ok", async () => {
    process.env.APP_OWNER_USER_ID = "u1";
    getSession.mockResolvedValue({
      data: { user: { id: "u1", email: "a@x.com", role: "admin" } },
    });
    const sql = vi.fn().mockResolvedValue([{ id: garmentId }]);
    requireSqlMock.mockReturnValue(sql as never);
    const res = await toggleGarmentFavorite(garmentId);
    expect(res.ok).toBe(true);
    expect(sql).toHaveBeenCalled();
  });

  /**
   * The UPDATE is scoped by user_id, so another account's id simply matches no
   * rows. Reporting ok left the optimistic UI showing a favorite that was
   * never stored.
   */
  it("reports not found when no row was updated", async () => {
    process.env.APP_OWNER_USER_ID = "u1";
    getSession.mockResolvedValue({
      data: { user: { id: "u1", email: "a@x.com", role: "admin" } },
    });
    const sql = vi.fn().mockResolvedValue([]);
    requireSqlMock.mockReturnValue(sql as never);

    const res = await toggleGarmentFavorite(garmentId);

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/not found/i);
  });

  it("rejects a non-uuid id before querying", async () => {
    process.env.APP_OWNER_USER_ID = "u1";
    getSession.mockResolvedValue({
      data: { user: { id: "u1", email: "a@x.com", role: "admin" } },
    });
    const sql = vi.fn();
    requireSqlMock.mockReturnValue(sql as never);

    const res = await toggleGarmentFavorite("not-a-uuid");

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/invalid garment id/i);
    expect(sql).not.toHaveBeenCalled();
  });
});
