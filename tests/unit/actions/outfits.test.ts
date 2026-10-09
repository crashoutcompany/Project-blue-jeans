import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/admitted", () => ({
  assertAdmittedForServerAction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  requireSql: vi.fn(),
}));

vi.mock("@/lib/outfits/promote-fit", () => ({
  promoteWeeklyFitToOutfit: vi.fn(),
}));

vi.mock("@/lib/outfits/persist-generator-outfit", () => ({
  assignOutfitToDay: vi.fn(),
}));

vi.mock("@/lib/time/product-timezone", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/time/product-timezone")>();
  return {
    ...actual,
    productTodayIso: vi.fn(() => "2026-08-10"),
  };
});

import { revalidateTag } from "next/cache";

import {
  admitted,
  NOT_ADMITTED_MESSAGE,
  notAdmitted,
} from "@/tests/helpers/admission";
import { assertAdmittedForServerAction } from "@/lib/auth/admitted";
import { requireSql } from "@/lib/db";
import { calendarMonthTag } from "@/lib/outfits/calendar-month-cache-tag";
import { closetSavedOutfitsTag } from "@/lib/outfits/closet-saved-outfits-cache-tag";
import { assignOutfitToDay } from "@/lib/outfits/persist-generator-outfit";
import { promoteWeeklyFitToOutfit } from "@/lib/outfits/promote-fit";
import {
  approveWeeklyPlanLook,
  getTodaysOutfitId,
  renameOutfit,
  wearOutfitToday,
} from "@/app/actions/outfits";

const gate = vi.mocked(assertAdmittedForServerAction);
const sqlMock = vi.mocked(requireSql);
const promote = vi.mocked(promoteWeeklyFitToOutfit);
const assign = vi.mocked(assignOutfitToDay);
const revalidateTagMock = vi.mocked(revalidateTag);

const PLAN_LOOK_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const OUTFIT_ID = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

/** Tags passed to revalidateTag, i.e. the cached Wearer surfaces refreshed. */
function revalidatedTags(): unknown[] {
  return revalidateTagMock.mock.calls.map((call) => call[0]);
}

function sqlReturning(rows: unknown) {
  const sql = vi.fn().mockResolvedValue(rows);
  sqlMock.mockReturnValue(sql as never);
  return sql;
}

beforeEach(() => {
  vi.clearAllMocks();
  gate.mockResolvedValue(admitted("u1"));
});

describe("approveWeeklyPlanLook", () => {
  it("returns the admission error without promoting", async () => {
    gate.mockResolvedValue(notAdmitted);

    await expect(approveWeeklyPlanLook(PLAN_LOOK_ID)).resolves.toEqual({
      ok: false,
      message: NOT_ADMITTED_MESSAGE,
    });
    expect(promote).not.toHaveBeenCalled();
  });

  it("rejects a non-uuid id before promoting", async () => {
    await expect(approveWeeklyPlanLook("not-a-uuid")).resolves.toEqual({
      ok: false,
      message: "Invalid plan look id.",
    });
    expect(promote).not.toHaveBeenCalled();
  });

  it("promotes the Fit for the signed-in Wearer and refreshes Outfit surfaces", async () => {
    promote.mockResolvedValue({ ok: true, outfitId: OUTFIT_ID });

    await expect(approveWeeklyPlanLook(PLAN_LOOK_ID)).resolves.toEqual({
      ok: true,
      outfitId: OUTFIT_ID,
    });
    expect(promote).toHaveBeenCalledWith("u1", PLAN_LOOK_ID);
    expect(revalidatedTags()).toEqual(
      expect.arrayContaining([closetSavedOutfitsTag("u1"), calendarMonthTag("u1")]),
    );
  });

  it("passes a promotion failure through without revalidating", async () => {
    promote.mockResolvedValue({ ok: false, message: "That weekly look was not found." });

    await expect(approveWeeklyPlanLook(PLAN_LOOK_ID)).resolves.toEqual({
      ok: false,
      message: "That weekly look was not found.",
    });
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });
});

describe("wearOutfitToday", () => {
  it("returns the admission error without assigning", async () => {
    gate.mockResolvedValue(notAdmitted);

    const res = await wearOutfitToday(OUTFIT_ID);

    expect(res.ok).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });

  it("rejects a non-uuid id before assigning", async () => {
    await expect(wearOutfitToday("nope")).resolves.toEqual({
      ok: false,
      message: "Invalid outfit id.",
    });
    expect(assign).not.toHaveBeenCalled();
  });

  it("assigns the Outfit to the product-timezone today", async () => {
    assign.mockResolvedValue({ ok: true, outfitId: OUTFIT_ID });

    await expect(wearOutfitToday(OUTFIT_ID)).resolves.toEqual({
      ok: true,
      outfitId: OUTFIT_ID,
    });
    expect(assign).toHaveBeenCalledWith({
      userId: "u1",
      outfitId: OUTFIT_ID,
      wornOn: "2026-08-10",
    });
    expect(revalidatedTags()).toContain(calendarMonthTag("u1"));
  });

  it("does not revalidate when the assignment fails", async () => {
    assign.mockResolvedValue({ ok: false, message: "That outfit was not found." });

    const res = await wearOutfitToday(OUTFIT_ID);

    expect(res.ok).toBe(false);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });
});

describe("renameOutfit", () => {
  it("returns the admission error without querying", async () => {
    gate.mockResolvedValue(notAdmitted);
    const sql = sqlReturning([{ id: OUTFIT_ID }]);

    const res = await renameOutfit(OUTFIT_ID, "Rainy Tuesday");

    expect(res.ok).toBe(false);
    expect(sql).not.toHaveBeenCalled();
  });

  it("stores a trimmed name scoped to the Wearer", async () => {
    const sql = sqlReturning([{ id: OUTFIT_ID }]);

    await expect(renameOutfit(OUTFIT_ID, "  Rainy Tuesday  ")).resolves.toEqual({
      ok: true,
    });
    expect(sql.mock.calls[0]?.slice(1)).toEqual(["Rainy Tuesday", OUTFIT_ID, "u1"]);
  });

  it("clears the name when given only whitespace", async () => {
    const sql = sqlReturning([{ id: OUTFIT_ID }]);

    await renameOutfit(OUTFIT_ID, "   ");

    expect(sql.mock.calls[0]?.[1]).toBeNull();
  });

  /** loadCalendarMonthData is cached under calendarMonthTag and reads name. */
  it("invalidates the calendar month as well as the saved outfits list", async () => {
    sqlReturning([{ id: OUTFIT_ID }]);

    await renameOutfit(OUTFIT_ID, "Rainy Tuesday");

    expect(revalidatedTags()).toEqual(
      expect.arrayContaining([closetSavedOutfitsTag("u1"), calendarMonthTag("u1")]),
    );
  });

  it("reports not found without invalidating caches", async () => {
    sqlReturning([]);

    await expect(renameOutfit(OUTFIT_ID, "Nope")).resolves.toEqual({
      ok: false,
      message: "That outfit was not found.",
    });
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("returns a safe message when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    sqlMock.mockReturnValue(
      vi.fn().mockRejectedValue(new Error("connection reset")) as never,
    );

    await expect(renameOutfit(OUTFIT_ID, "Rainy Tuesday")).resolves.toEqual({
      ok: false,
      message: "Could not rename this outfit.",
    });
  });
});

describe("getTodaysOutfitId", () => {
  it("returns null without querying when not admitted", async () => {
    gate.mockResolvedValue(notAdmitted);
    const sql = sqlReturning([{ outfit_id: OUTFIT_ID }]);

    await expect(getTodaysOutfitId()).resolves.toBeNull();
    expect(sql).not.toHaveBeenCalled();
  });

  it("returns the Outfit worn today", async () => {
    const sql = sqlReturning([{ outfit_id: OUTFIT_ID }]);

    await expect(getTodaysOutfitId()).resolves.toBe(OUTFIT_ID);
    expect(sql.mock.calls[0]?.slice(1)).toEqual(["u1", "2026-08-10"]);
  });

  it("returns null when nothing is worn today or the read fails", async () => {
    sqlReturning([]);
    await expect(getTodaysOutfitId()).resolves.toBeNull();

    sqlMock.mockReturnValue(vi.fn().mockRejectedValue(new Error("down")) as never);
    await expect(getTodaysOutfitId()).resolves.toBeNull();
  });
});
