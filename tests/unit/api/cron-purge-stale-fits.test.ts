import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/outfits/purge-stale-weekly-fits", () => ({
  purgeStaleWeeklyFits: vi.fn(),
}));

import { revalidatePath, revalidateTag } from "next/cache";
import { purgeStaleWeeklyFits } from "@/lib/outfits/purge-stale-weekly-fits";
import { calendarMonthTag } from "@/lib/outfits/calendar-month-cache-tag";
import { GET } from "@/app/api/cron/purge-stale-fits/route";

const purge = vi.mocked(purgeStaleWeeklyFits);
const revalidateTagMock = vi.mocked(revalidateTag);
const revalidatePathMock = vi.mocked(revalidatePath);

describe("GET /api/cron/purge-stale-fits", () => {
  const original = process.env.CRON_SECRET;

  beforeEach(() => {
    purge.mockReset();
    revalidateTagMock.mockReset();
    revalidatePathMock.mockReset();
    process.env.CRON_SECRET = "test-cron-secret";
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = original;
    }
  });

  it("returns 401 without a valid cron secret", async () => {
    const res = await GET(
      new Request("http://localhost/api/cron/purge-stale-fits"),
    );
    expect(res.status).toBe(401);
    expect(purge).not.toHaveBeenCalled();
  });

  it("purges stale Fits and revalidates affected Wearers", async () => {
    purge.mockResolvedValue({
      ok: true,
      deletedPlans: 2,
      userIds: ["u1", "u2"],
    });
    const res = await GET(
      new Request("http://localhost/api/cron/purge-stale-fits", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deletedPlans: 2 });
    expect(revalidateTagMock).toHaveBeenCalledWith(
      calendarMonthTag("u1"),
      "max",
    );
    expect(revalidateTagMock).toHaveBeenCalledWith(
      calendarMonthTag("u2"),
      "max",
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledWith("/calendar");
  });

  it("does not revalidate when nothing was deleted", async () => {
    purge.mockResolvedValue({ ok: true, deletedPlans: 0, userIds: [] });
    const res = await GET(
      new Request("http://localhost/api/cron/purge-stale-fits", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    );
    expect(res.status).toBe(200);
    expect(revalidateTagMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("returns 503 when the purge job cannot run", async () => {
    purge.mockResolvedValue({
      ok: false,
      message: "DATABASE_URL is not configured",
    });
    const res = await GET(
      new Request("http://localhost/api/cron/purge-stale-fits", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    );
    expect(res.status).toBe(503);
  });
});
