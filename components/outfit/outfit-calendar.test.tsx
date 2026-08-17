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

const PLAN_LOOK_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const GARMENT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

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
    render(
      <OutfitCalendar
        year={2025}
        month={1}
        saved={[]}
        weeklyDrafts={[
          {
            wornOn: "2025-01-06",
            planLookId: PLAN_LOOK_ID,
            title: "Weekly",
            heroImageUrl: null,
            garmentIds: [GARMENT_ID],
            garmentThumbs: [],
          },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: /approve/i }));
    expect(approveWeeklyPlanLook).toHaveBeenCalledWith(PLAN_LOOK_ID);
  });

  it("rings the product-timezone today cell", () => {
    render(
      <OutfitCalendar year={2025} month={3} saved={[]} weeklyDrafts={[]} />,
    );
    const day = screen.getByText("10", { selector: "span.tabular-nums" });
    expect(day.parentElement?.parentElement).toHaveClass("ring-primary/35");
  });

  it("fills the day tile with a hero image", () => {
    render(
      <OutfitCalendar
        year={2025}
        month={1}
        saved={[]}
        weeklyDrafts={[
          {
            wornOn: "2025-01-06",
            planLookId: PLAN_LOOK_ID,
            title: "Monday Kickoff",
            heroImageUrl: "https://cdn.example.com/hero.jpg",
            garmentIds: [],
            garmentThumbs: [],
          },
        ]}
      />,
    );
    expect(
      document.querySelector('img[src="https://cdn.example.com/hero.jpg"]'),
    ).toBeInTheDocument();
  });

  it("shows a garment collage when the hero is missing", () => {
    render(
      <OutfitCalendar
        year={2025}
        month={1}
        saved={[]}
        weeklyDrafts={[
          {
            wornOn: "2025-01-06",
            planLookId: PLAN_LOOK_ID,
            title: "Monday Focus",
            heroImageUrl: null,
            garmentIds: [GARMENT_ID],
            garmentThumbs: [
              { id: GARMENT_ID, imageUrl: "https://cdn.example.com/g1.jpg" },
              {
                id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
                imageUrl: "https://cdn.example.com/g2.jpg",
              },
            ],
          },
        ]}
      />,
    );
    expect(
      document.querySelectorAll("img[src^='https://cdn.example.com/g']"),
    ).toHaveLength(2);
  });

  it("does not use a dash placeholder on empty days", () => {
    render(
      <OutfitCalendar year={2025} month={3} saved={[]} weeklyDrafts={[]} />,
    );
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });
});
