import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  getSql: vi.fn(),
}));

vi.mock("@/lib/server/safe-client-error", () => ({
  logServerError: vi.fn(),
}));

import { getSql } from "@/lib/db";
import { purgeStaleWeeklyFits } from "@/lib/outfits/purge-stale-weekly-fits";

const getSqlMock = vi.mocked(getSql);

describe("purgeStaleWeeklyFits", () => {
  beforeEach(() => {
    getSqlMock.mockReset();
  });

  it("returns a configuration error when DATABASE_URL is missing", async () => {
    getSqlMock.mockReturnValue(undefined);
    const res = await purgeStaleWeeklyFits(
      new Date("2026-08-17T12:00:00.000Z"),
    );
    expect(res).toEqual({
      ok: false,
      message: "DATABASE_URL is not configured",
    });
  });

  it("deletes plans whose week_start is before the current Sunday week", async () => {
    const sql = vi.fn().mockResolvedValue([
      { user_id: "u1" },
      { user_id: "u1" },
      { user_id: "u2" },
    ]);
    getSqlMock.mockReturnValue(sql as never);

    // Monday Aug 17 2026 12:00 UTC → product date Monday; week start Sunday Aug 16.
    const res = await purgeStaleWeeklyFits(
      new Date("2026-08-17T16:00:00.000Z"),
    );

    expect(res).toEqual({
      ok: true,
      deletedPlans: 3,
      userIds: ["u1", "u2"],
    });
    expect(sql).toHaveBeenCalledTimes(1);
    const [, ...values] = sql.mock.calls[0] as unknown[];
    expect(values[0]).toBe("2026-08-16");
  });

  it("returns zero deletes when no stale plans exist", async () => {
    const sql = vi.fn().mockResolvedValue([]);
    getSqlMock.mockReturnValue(sql as never);
    const res = await purgeStaleWeeklyFits(
      new Date("2026-08-17T16:00:00.000Z"),
    );
    expect(res).toEqual({ ok: true, deletedPlans: 0, userIds: [] });
  });
});
