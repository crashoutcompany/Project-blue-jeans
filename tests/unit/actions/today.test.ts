import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/admitted", () => ({
  assertAdmittedForServerAction: vi.fn(),
}));

vi.mock("@/lib/outfits/persist-generator-outfit", () => ({
  unwearDay: vi.fn(),
}));

vi.mock("@/app/actions/outfits", () => ({
  approveWeeklyPlanLook: vi.fn(),
}));

vi.mock("@/lib/workflows/run-weekly-outfits", () => ({
  runWeeklyOutfitsJob: vi.fn(),
}));

vi.mock("@/lib/time/product-timezone", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/time/product-timezone")>();
  return {
    ...actual,
    // Monday; the Sunday-start week began 2026-08-09.
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
import { unwearDay } from "@/lib/outfits/persist-generator-outfit";
import { runWeeklyOutfitsJob } from "@/lib/workflows/run-weekly-outfits";
import { approveWeeklyPlanLook } from "@/app/actions/outfits";
import {
  planMyWeek,
  unwearDayForUser,
  wearThisFit,
} from "@/app/actions/today";

const gate = vi.mocked(assertAdmittedForServerAction);
const unwear = vi.mocked(unwearDay);
const runJob = vi.mocked(runWeeklyOutfitsJob);
const approve = vi.mocked(approveWeeklyPlanLook);
const revalidateTagMock = vi.mocked(revalidateTag);

const PLAN_LOOK_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

beforeEach(() => {
  vi.clearAllMocks();
  gate.mockResolvedValue(admitted("u1"));
});

describe("planMyWeek", () => {
  it("returns the admission error without planning", async () => {
    gate.mockResolvedValue(notAdmitted);

    await expect(planMyWeek()).resolves.toEqual({
      ok: false,
      message: NOT_ADMITTED_MESSAGE,
    });
    expect(runJob).not.toHaveBeenCalled();
  });

  it("plans the current Sunday-start week and refreshes Outfit surfaces", async () => {
    runJob.mockResolvedValue({ ok: true, planId: "p1", skipped: false });

    await expect(planMyWeek()).resolves.toEqual({ ok: true, skipped: false });
    expect(runJob).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", weekStart: "2026-08-09" }),
    );
    expect(revalidateTagMock).toHaveBeenCalled();
  });

  it("reports when every remaining day is already planned", async () => {
    runJob.mockResolvedValue({ ok: true, planId: "p1", skipped: true });

    await expect(planMyWeek()).resolves.toEqual({ ok: true, skipped: true });
  });

  it("surfaces a job failure without revalidating", async () => {
    runJob.mockResolvedValue({
      ok: false,
      error: "Add at least one top, bottom, and pair of shoes.",
    });

    await expect(planMyWeek()).resolves.toEqual({
      ok: false,
      message: "Add at least one top, bottom, and pair of shoes.",
    });
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("hides unexpected errors behind a retry message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    runJob.mockRejectedValue(new Error("Gemini 500: internal stack"));

    await expect(planMyWeek()).resolves.toEqual({
      ok: false,
      message: "Could not plan your week. Try again in a moment.",
    });
  });
});

describe("wearThisFit", () => {
  it("promotes the Fit and drops the Outfit id from the result", async () => {
    approve.mockResolvedValue({ ok: true, outfitId: "o1" });

    await expect(wearThisFit(PLAN_LOOK_ID)).resolves.toEqual({ ok: true });
    expect(approve).toHaveBeenCalledWith(PLAN_LOOK_ID);
  });

  it("passes the promotion error through", async () => {
    approve.mockResolvedValue({ ok: false, message: "Past days are view only." });

    await expect(wearThisFit(PLAN_LOOK_ID)).resolves.toEqual({
      ok: false,
      message: "Past days are view only.",
    });
  });
});

describe("unwearDayForUser", () => {
  it("returns the admission error without unwearing", async () => {
    gate.mockResolvedValue(notAdmitted);

    await expect(unwearDayForUser("2026-08-10")).resolves.toEqual({
      ok: false,
      message: NOT_ADMITTED_MESSAGE,
    });
    expect(unwear).not.toHaveBeenCalled();
  });

  it("rejects malformed dates without unwearing", async () => {
    await expect(unwearDayForUser("2026-02-30")).resolves.toEqual({
      ok: false,
      message: "Invalid date.",
    });
    expect(unwear).not.toHaveBeenCalled();
  });

  it("rejects past dates without unwearing", async () => {
    const res = await unwearDayForUser("2026-08-09");

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/past/i);
    expect(unwear).not.toHaveBeenCalled();
  });

  it.each(["2026-08-10", "2026-08-12"])(
    "unwears %s for the signed-in Wearer",
    async (wornOn) => {
      unwear.mockResolvedValue({ ok: true, outfitId: "o1" });

      await expect(unwearDayForUser(wornOn)).resolves.toEqual({ ok: true });
      expect(unwear).toHaveBeenCalledWith("u1", wornOn);
      expect(revalidateTagMock).toHaveBeenCalled();
    },
  );

  it("passes an unwear failure through without revalidating", async () => {
    unwear.mockResolvedValue({ ok: false, message: "Nothing is worn that day." });

    await expect(unwearDayForUser("2026-08-10")).resolves.toEqual({
      ok: false,
      message: "Nothing is worn that day.",
    });
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });
});
