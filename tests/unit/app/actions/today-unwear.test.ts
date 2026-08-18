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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/time/product-timezone", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/time/product-timezone")>();
  return {
    ...actual,
    productTodayIso: vi.fn(() => "2026-08-10"),
  };
});

import { assertAdmittedForServerAction } from "@/lib/auth/admitted";
import { unwearDay } from "@/lib/outfits/persist-generator-outfit";
import { unwearDayForUser } from "@/app/actions/today";

const gate = vi.mocked(assertAdmittedForServerAction);
const unwear = vi.mocked(unwearDay);

describe("unwearDayForUser", () => {
  beforeEach(() => {
    gate.mockReset();
    unwear.mockReset();
    gate.mockResolvedValue({
      ok: true,
      userId: "u1",
      membership: {
        userId: "u1",
        accessRole: "owner",
        credentialSource: "platform_env",
        status: "active",
        persisted: false,
      },
    });
  });

  it("rejects past dates", async () => {
    const res = await unwearDayForUser("2026-08-09");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/past/i);
    expect(unwear).not.toHaveBeenCalled();
  });

  it("rejects malformed dates without calling unwear", async () => {
    const res = await unwearDayForUser("2026-02-30");
    expect(res).toEqual({ ok: false, message: "Invalid date." });
    expect(unwear).not.toHaveBeenCalled();
  });

  it("returns the admission gate error without calling unwear", async () => {
    gate.mockResolvedValue({
      ok: false,
      message: "This account has not been admitted to Blue Jeans.",
    });
    const res = await unwearDayForUser("2026-08-10");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toContain("admitted");
    }
    expect(unwear).not.toHaveBeenCalled();
  });

  it("unwears today and future dates", async () => {
    unwear.mockResolvedValue({ ok: true, outfitId: "o1" });
    const today = await unwearDayForUser("2026-08-10");
    expect(today.ok).toBe(true);
    expect(unwear).toHaveBeenCalledWith("u1", "2026-08-10");

    unwear.mockClear();
    const future = await unwearDayForUser("2026-08-12");
    expect(future.ok).toBe(true);
    expect(unwear).toHaveBeenCalledWith("u1", "2026-08-12");
  });
});
