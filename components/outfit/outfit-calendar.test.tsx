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

  it("marks the product-timezone today cell as the current date", () => {
    render(
      <OutfitCalendar year={2025} month={3} saved={[]} weeklyDrafts={[]} />,
    );
    const current = document.querySelectorAll('[aria-current="date"]');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent(/^10/);
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

  describe("grid rows", () => {
    // 7 weekday headers + one cell per grid slot.
    const gridCells = () =>
      screen.getByTestId("calendar-grid").children.length - 7;

    it.each([
      ["Feb 2026 (starts Sunday, 28 days)", 2026, 2, 28],
      ["Oct 2026 (ends on Saturday the 31st)", 2026, 10, 35],
      ["Aug 2026 (starts Saturday, 31 days)", 2026, 8, 42],
    ])("renders only the weeks %s needs", (_label, year, month, expected) => {
      render(
        <OutfitCalendar
          year={year}
          month={month}
          saved={[]}
          weeklyDrafts={[]}
        />,
      );
      expect(gridCells()).toBe(expected);
    });

    it("does not spill into the next month", () => {
      render(
        <OutfitCalendar year={2026} month={10} saved={[]} weeklyDrafts={[]} />,
      );
      const grid = screen.getByTestId("calendar-grid");
      expect(grid).toHaveTextContent("31");
      expect(grid).not.toHaveTextContent(/\b(32|33)\b/);
      // The last row is the 25th-31st week, not a blank week of Nov 1-7.
      expect(grid.lastElementChild).toHaveTextContent("31");
    });
  });

  it("gives day cells a visible border and fill", () => {
    render(
      <OutfitCalendar year={2025} month={3} saved={[]} weeklyDrafts={[]} />,
    );
    const cell = document.querySelector('[aria-current="date"]');
    expect(cell).toHaveClass("border", "border-foreground/10", "bg-muted/60");
  });

  describe("empty state", () => {
    it("tells the user when nothing is planned this month", () => {
      render(
        <OutfitCalendar year={2025} month={3} saved={[]} weeklyDrafts={[]} />,
      );
      expect(screen.getByRole("status")).toHaveTextContent(
        "No looks planned yet",
      );
      expect(
        screen.getByRole("link", { name: /go to today/i }),
      ).toHaveAttribute("href", "/");
    });

    it("is hidden once the month has a weekly draft", () => {
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
              garmentIds: [],
              garmentThumbs: [],
            },
          ]}
        />,
      );
      expect(
        screen.queryByText("No looks planned yet"),
      ).not.toBeInTheDocument();
    });

    it("is hidden once the month has a saved outfit", () => {
      render(
        <OutfitCalendar
          year={2025}
          month={1}
          saved={[
            {
              id: GARMENT_ID,
              wornOn: "2025-01-08",
              imageUrl: null,
              name: "Brunch",
              occasion: "casual",
              garmentThumbs: [],
            },
          ]}
          weeklyDrafts={[]}
        />,
      );
      expect(
        screen.queryByText("No looks planned yet"),
      ).not.toBeInTheDocument();
    });

    it("is skipped on the prerendered placeholder shell", () => {
      render(
        <OutfitCalendar
          year={2026}
          month={1}
          saved={[]}
          weeklyDrafts={[]}
          isPlaceholder
        />,
      );
      expect(
        screen.queryByText("No looks planned yet"),
      ).not.toBeInTheDocument();
    });
  });
});
