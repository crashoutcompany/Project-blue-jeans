import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const approveWeeklyPlanLook = vi.fn();

vi.mock("@/app/actions/outfits", () => ({
  approveWeeklyPlanLook: (...args: unknown[]) => approveWeeklyPlanLook(...args),
}));

vi.mock("@/lib/time/product-timezone", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/time/product-timezone")>();
  return {
    ...actual,
    productTodayIso: vi.fn(() => "2025-03-10"),
  };
});

import { OutfitCalendar } from "@/components/outfit/outfit-calendar";

describe("OutfitCalendar", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders month title and nav links", () => {
    render(
      <OutfitCalendar year={2025} month={3} saved={[]} weeklyDrafts={[]} />,
    );
    expect(screen.getByText(/2025/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /previous month/i }),
    ).toHaveAttribute("href", "/calendar?year=2025&month=2");
    expect(screen.getByRole("link", { name: /next month/i })).toHaveAttribute(
      "href",
      "/calendar?year=2025&month=4",
    );
  });

  it("calls approveWeeklyPlanLook when Approve is clicked", async () => {
    const user = userEvent.setup();
    approveWeeklyPlanLook.mockResolvedValue({
      ok: true,
      outfitId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    });
    const planLookId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    render(
      <OutfitCalendar
        year={2025}
        month={1}
        saved={[]}
        weeklyDrafts={[
          {
            wornOn: "2025-01-06",
            planLookId,
            title: "Weekly",
            heroImageUrl: null,
            garmentIds: ["f47ac10b-58cc-4372-a567-0e02b2c3d479"],
          },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: /approve/i }));
    expect(approveWeeklyPlanLook).toHaveBeenCalledWith(planLookId);
  });

  it("rings the product-timezone today cell", () => {
    render(
      <OutfitCalendar year={2025} month={3} saved={[]} weeklyDrafts={[]} />,
    );
    const day = screen.getByText("10", { selector: "span.tabular-nums" });
    expect(day.parentElement?.parentElement).toHaveClass("ring-primary/35");
  });
});
