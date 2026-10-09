import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  requireSql: vi.fn(),
}));

vi.mock("@/lib/outfits/persist-generator-outfit", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/outfits/persist-generator-outfit")>();
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

import { requireSql } from "@/lib/db";
import { commitOutfitForDay } from "@/lib/outfits/persist-generator-outfit";
import { promoteWeeklyFitToOutfit } from "@/lib/outfits/promote-fit";

const sqlMock = vi.mocked(requireSql);
const commitMock = vi.mocked(commitOutfitForDay);

const PLAN_LOOK_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const GARMENT_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const OUTFIT_ID = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

function planLookRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PLAN_LOOK_ID,
    hero_image_url: "https://cdn.example.com/hero.jpg",
    garment_ids: [GARMENT_ID],
    worn_on: "2026-08-10",
    ...overrides,
  };
}

/** Plan-look lookup, then the garment ownership count. */
function sqlSequence(...results: unknown[]) {
  const sql = vi.fn();
  for (const result of results) sql.mockResolvedValueOnce(result);
  sqlMock.mockReturnValue(sql as never);
  return sql;
}

describe("promoteWeeklyFitToOutfit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports a Fit that does not belong to the Wearer as not found", async () => {
    const sql = sqlSequence([]);

    await expect(promoteWeeklyFitToOutfit("u1", PLAN_LOOK_ID)).resolves.toEqual({
      ok: false,
      message: "That weekly look was not found.",
    });
    expect(sql.mock.calls[0]?.slice(1)).toEqual([PLAN_LOOK_ID, "u1"]);
    expect(commitMock).not.toHaveBeenCalled();
  });

  it("rejects a past-day Fit without committing", async () => {
    sqlSequence([planLookRow({ worn_on: "2026-08-09" })]);

    const res = await promoteWeeklyFitToOutfit("u1", PLAN_LOOK_ID);

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/past/i);
    expect(commitMock).not.toHaveBeenCalled();
  });

  it("rejects a Fit with no linked garments", async () => {
    sqlSequence([planLookRow({ garment_ids: [] })]);

    await expect(promoteWeeklyFitToOutfit("u1", PLAN_LOOK_ID)).resolves.toEqual({
      ok: false,
      message: "This look has no linked garments to save.",
    });
    expect(commitMock).not.toHaveBeenCalled();
  });

  it("rejects a Fit whose garments are no longer in the closet", async () => {
    sqlSequence([planLookRow()], [{ n: 0 }]);

    await expect(promoteWeeklyFitToOutfit("u1", PLAN_LOOK_ID)).resolves.toEqual({
      ok: false,
      message: "One or more garments are missing from your closet.",
    });
    expect(commitMock).not.toHaveBeenCalled();
  });

  it("commits the Fit's garments and hero to its calendar day", async () => {
    sqlSequence([planLookRow({ garment_ids: [GARMENT_ID, GARMENT_ID] })], [{ n: 1 }]);
    commitMock.mockResolvedValue(OUTFIT_ID);

    await expect(promoteWeeklyFitToOutfit("u1", PLAN_LOOK_ID)).resolves.toEqual({
      ok: true,
      outfitId: OUTFIT_ID,
    });
    expect(commitMock).toHaveBeenCalledWith({
      userId: "u1",
      wornOn: "2026-08-10",
      garmentIds: [GARMENT_ID],
      imageUrl: "https://cdn.example.com/hero.jpg",
      occasion: "casual",
    });
  });

  it("returns a safe message when the commit fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    sqlSequence([planLookRow()], [{ n: 1 }]);
    commitMock.mockRejectedValue(new Error("deadlock detected"));

    await expect(promoteWeeklyFitToOutfit("u1", PLAN_LOOK_ID)).resolves.toEqual({
      ok: false,
      message: "Could not approve this look. Try again.",
    });
  });
});
