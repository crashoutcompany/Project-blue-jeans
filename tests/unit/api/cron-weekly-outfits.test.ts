import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/workflows/run-weekly-outfits", () => ({
  runWeeklyOutfitsJob: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getSql: vi.fn(),
}));

import { getSql } from "@/lib/db";
import { runWeeklyOutfitsJob } from "@/lib/workflows/run-weekly-outfits";
import { GET } from "@/app/api/cron/weekly-outfits/route";

const job = vi.mocked(runWeeklyOutfitsJob);
const getSqlMock = vi.mocked(getSql);

describe("GET /api/cron/weekly-outfits", () => {
  const prevSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    job.mockReset();
    getSqlMock.mockReset();
    process.env.CRON_SECRET = "secret";
  });

  afterEach(() => {
    process.env.CRON_SECRET = prevSecret;
  });

  it("returns 500 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(
      new Request("http://localhost/api/cron/weekly-outfits", {
        headers: { authorization: "Bearer secret" },
      }),
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain("CRON_SECRET");
  });

  it("returns 401 when bearer token wrong", async () => {
    const res = await GET(
      new Request("http://localhost/api/cron/weekly-outfits", {
        headers: { authorization: "Bearer wrong" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("invokes runWeeklyOutfitsJob per Wearer with garments", async () => {
    const sql = vi.fn().mockResolvedValue([{ user_id: "u1" }, { user_id: "u2" }]);
    getSqlMock.mockReturnValue(sql as never);
    job.mockResolvedValue({
      ok: true,
      skipped: false,
      planId: "p1",
    });
    const res = await GET(
      new Request("http://localhost/api/cron/weekly-outfits", {
        headers: { authorization: "Bearer secret" },
      }),
    );
    expect(res.status).toBe(200);
    expect(job).toHaveBeenCalledTimes(2);
    expect(job).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1" }),
    );
    expect(job).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u2" }),
    );
  });

  it("returns 200 with zero accounts when no garments", async () => {
    const sql = vi.fn().mockResolvedValue([]);
    getSqlMock.mockReturnValue(sql as never);
    const res = await GET(
      new Request("http://localhost/api/cron/weekly-outfits", {
        headers: { authorization: "Bearer secret" },
      }),
    );
    expect(res.status).toBe(200);
    expect(job).not.toHaveBeenCalled();
  });

  it("returns 500 when job fails", async () => {
    const sql = vi.fn().mockResolvedValue([{ user_id: "u1" }]);
    getSqlMock.mockReturnValue(sql as never);
    job.mockResolvedValue({
      ok: false,
      error: "fail",
    });
    const res = await GET(
      new Request("http://localhost/api/cron/weekly-outfits", {
        headers: { authorization: "Bearer secret" },
      }),
    );
    expect(res.status).toBe(500);
  });
});
