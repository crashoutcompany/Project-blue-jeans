import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({
  auth: {
    getAuthoritativeSession: vi.fn(),
    getSession: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  requireSql: vi.fn(),
  getSql: vi.fn(),
}));

vi.mock("@/lib/outfits/persist-generator-outfit", async (orig) => {
  const actual =
    await orig<typeof import("@/lib/outfits/persist-generator-outfit")>();
  return {
    ...actual,
    commitOutfitForDay: vi.fn(),
  };
});

vi.mock("@/lib/time/product-timezone", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/time/product-timezone")>();
  return {
    ...actual,
    productTodayIso: vi.fn(() => "2026-08-10"),
  };
});

import { revalidateTag } from "next/cache";

import { auth } from "@/lib/auth/server";
import { getSql, requireSql } from "@/lib/db";
import { calendarMonthTag } from "@/lib/outfits/calendar-month-cache-tag";
import { closetSavedOutfitsTag } from "@/lib/outfits/closet-saved-outfits-cache-tag";
import { commitOutfitForDay } from "@/lib/outfits/persist-generator-outfit";
import { approveWeeklyPlanLook, renameOutfit } from "@/app/actions/outfits";

const getSession = vi.mocked(auth.getAuthoritativeSession);
const sqlMock = vi.mocked(requireSql);
const commitMock = vi.mocked(commitOutfitForDay);
const revalidateTagMock = vi.mocked(revalidateTag);

function adminSession() {
  process.env.APP_OWNER_USER_ID = "u1";
  return {
    data: {
      user: {
        id: "u1",
        email: "a@x.com",
        role: "admin",
        name: "Admin",
      },
    },
  };
}

describe("approveWeeklyPlanLook", () => {
  const planLookId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const originalOwnerId = process.env.APP_OWNER_USER_ID;

  beforeEach(() => {
    getSession.mockReset();
    sqlMock.mockReset();
    commitMock.mockReset();
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
      data: {
        user: { id: "u1", email: "u@x.com", role: "user", name: "User" },
      },
    });
    const res = await approveWeeklyPlanLook(planLookId);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toBeDefined();
  });

  it("returns error for invalid uuid", async () => {
    getSession.mockResolvedValue(adminSession());
    const res = await approveWeeklyPlanLook("not-a-uuid");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("Invalid");
  });

  it("returns not found when no row", async () => {
    getSession.mockResolvedValue(adminSession());
    const sql = vi.fn().mockResolvedValueOnce([]);
    sqlMock.mockReturnValue(sql as never);
    const res = await approveWeeklyPlanLook(planLookId);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("not found");
  });

  it("returns error when garment_ids empty", async () => {
    getSession.mockResolvedValue(adminSession());
    const sql = vi.fn().mockResolvedValueOnce([
      {
        id: planLookId,
        hero_image_url: null,
        garment_ids: [],
        worn_on: "2026-08-10",
      },
    ]);
    sqlMock.mockReturnValue(sql as never);
    const res = await approveWeeklyPlanLook(planLookId);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("no linked garments");
  });

  it("returns error when garment count mismatch", async () => {
    getSession.mockResolvedValue(adminSession());
    const gid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    const sql = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: planLookId,
          hero_image_url: null,
          garment_ids: [gid],
          worn_on: "2026-08-10",
        },
      ])
      .mockResolvedValueOnce([{ n: 0 }]);
    sqlMock.mockReturnValue(sql as never);
    const res = await approveWeeklyPlanLook(planLookId);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("missing");
  });

  it("rejects past-day looks without committing", async () => {
    getSession.mockResolvedValue(adminSession());
    const gid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    const sql = vi.fn().mockResolvedValueOnce([
      {
        id: planLookId,
        hero_image_url: null,
        garment_ids: [gid],
        worn_on: "2026-08-09",
      },
    ]);
    sqlMock.mockReturnValue(sql as never);
    const res = await approveWeeklyPlanLook(planLookId);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/past/i);
    expect(commitMock).not.toHaveBeenCalled();
  });

  it("commits outfit and returns ok", async () => {
    getSession.mockResolvedValue(adminSession());
    const gid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    const outfitId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    const sql = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: planLookId,
          hero_image_url: null,
          garment_ids: [gid],
          worn_on: "2026-08-10",
        },
      ])
      .mockResolvedValueOnce([{ n: 1 }]);
    sqlMock.mockReturnValue(sql as never);
    commitMock.mockResolvedValue(outfitId);
    const res = await approveWeeklyPlanLook(planLookId);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.outfitId).toBe(outfitId);
    expect(commitMock).toHaveBeenCalled();
  });
});

describe("renameOutfit", () => {
  const outfitId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

  beforeEach(() => {
    revalidateTagMock.mockClear();
  });

  /** loadCalendarMonthData is cached under calendarMonthTag and reads name. */
  it("invalidates the calendar month as well as the saved outfits list", async () => {
    getSession.mockResolvedValue(adminSession());
    sqlMock.mockReturnValue(
      vi.fn().mockResolvedValue([{ id: outfitId }]) as never,
    );

    const res = await renameOutfit(outfitId, "Rainy Tuesday");

    expect(res.ok).toBe(true);
    const tags = revalidateTagMock.mock.calls.map((call) => call[0]);
    expect(tags).toContain(closetSavedOutfitsTag("u1"));
    expect(tags).toContain(calendarMonthTag("u1"));
  });

  it("does not invalidate caches when the outfit was not found", async () => {
    getSession.mockResolvedValue(adminSession());
    sqlMock.mockReturnValue(vi.fn().mockResolvedValue([]) as never);

    const res = await renameOutfit(outfitId, "Nope");

    expect(res.ok).toBe(false);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });
});
