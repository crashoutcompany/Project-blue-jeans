import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({
  auth: {
    getSession: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  requireSql: vi.fn(),
}));

vi.mock("@/lib/outfits/persist-generator-outfit", async (orig) => {
  const actual = await orig<
    typeof import("@/lib/outfits/persist-generator-outfit")
  >();
  return {
    ...actual,
    insertOutfitWithGarments: vi.fn(),
  };
});

import { auth } from "@/lib/auth/server";
import { requireSql } from "@/lib/db";
import { insertOutfitWithGarments } from "@/lib/outfits/persist-generator-outfit";
import { approveWeeklyPlanLook } from "@/app/actions/outfits";

const getSession = vi.mocked(auth.getSession);
const sqlMock = vi.mocked(requireSql);
const insertMock = vi.mocked(insertOutfitWithGarments);

describe("approveWeeklyPlanLook", () => {
  const planLookId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

  beforeEach(() => {
    getSession.mockReset();
    sqlMock.mockReset();
    insertMock.mockReset();
  });

  it("returns error when not admin", async () => {
    getSession.mockResolvedValue({
      data: { user: { email: "u@x.com", role: "user" } },
    });
    const res = await approveWeeklyPlanLook(planLookId);
    expect(res.ok).toBe(false);
    expect(res.message).toBeDefined();
  });

  it("returns error for invalid uuid", async () => {
    getSession.mockResolvedValue({
      data: { user: { email: "a@x.com", role: "admin" } },
    });
    const res = await approveWeeklyPlanLook("not-a-uuid");
    expect(res.ok).toBe(false);
    expect(res.message).toContain("Invalid");
  });

  it("returns not found when no row", async () => {
    getSession.mockResolvedValue({
      data: { user: { email: "a@x.com", role: "admin" } },
    });
    const sql = vi.fn().mockResolvedValueOnce([]);
    sqlMock.mockReturnValue(sql as never);
    const res = await approveWeeklyPlanLook(planLookId);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("not found");
  });

  it("returns error when garment_ids empty", async () => {
    getSession.mockResolvedValue({
      data: { user: { email: "a@x.com", role: "admin" } },
    });
    const sql = vi.fn().mockResolvedValueOnce([
      {
        id: planLookId,
        title: "Look",
        hero_image_url: null,
        garment_ids: [],
        worn_on: "2025-01-01",
      },
    ]);
    sqlMock.mockReturnValue(sql as never);
    const res = await approveWeeklyPlanLook(planLookId);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("no linked garments");
  });

  it("returns error when garment count mismatch", async () => {
    getSession.mockResolvedValue({
      data: { user: { email: "a@x.com", role: "admin" } },
    });
    const gid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    const sql = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: planLookId,
          title: "Look",
          hero_image_url: null,
          garment_ids: [gid],
          worn_on: "2025-01-01",
        },
      ])
      .mockResolvedValueOnce([{ n: 0 }]);
    sqlMock.mockReturnValue(sql as never);
    const res = await approveWeeklyPlanLook(planLookId);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("missing");
  });

  it("inserts outfit and returns ok", async () => {
    getSession.mockResolvedValue({
      data: { user: { email: "a@x.com", role: "admin" } },
    });
    const gid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    const outfitId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    const sql = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: planLookId,
          title: "Look",
          hero_image_url: null,
          garment_ids: [gid],
          worn_on: "2025-01-01",
        },
      ])
      .mockResolvedValueOnce([{ n: 1 }]);
    sqlMock.mockReturnValue(sql as never);
    insertMock.mockResolvedValue(outfitId);
    const res = await approveWeeklyPlanLook(planLookId);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.outfitId).toBe(outfitId);
    expect(insertMock).toHaveBeenCalled();
  });
});
