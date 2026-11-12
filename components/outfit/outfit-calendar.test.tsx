import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const approveWeeklyPlanLook = vi.fn();

vi.mock("@/app/actions/outfits", () => ({
  approveWeeklyPlanLook: (...args: unknown[]) => approveWeeklyPlanLook(...args),
}));

const markDayWorn = vi.fn();

vi.mock("@/app/actions/today", () => ({
  markDayWorn: (...args: unknown[]) => markDayWorn(...args),
}));

import { OutfitCalendar } from "@/components/outfit/outfit-calendar";

const TODAY = "2025-03-10";
const PLAN_LOOK_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const GARMENT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

describe("OutfitCalendar", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders month title and nav links", () => {
    render(
      <OutfitCalendar
        year={2025}
        month={3}
        saved={[]}
        weeklyDrafts={[]}
        todayIso={TODAY}
      />,
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
        todayIso={TODAY}
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
      <OutfitCalendar
        year={2025}
        month={3}
        saved={[]}
        weeklyDrafts={[]}
        todayIso={TODAY}
      />,
    );
    const current = document.querySelectorAll('[aria-current="date"]');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent(/^10/);
  });

  it("fills the day tile with a hero image", () => {
    render(
      <OutfitCalendar
        todayIso={TODAY}
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
        todayIso={TODAY}
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
          todayIso={TODAY}
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
        <OutfitCalendar
          year={2026}
          month={10}
          saved={[]}
          weeklyDrafts={[]}
          todayIso={TODAY}
        />,
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
      <OutfitCalendar
        year={2025}
        month={3}
        saved={[]}
        weeklyDrafts={[]}
        todayIso={TODAY}
      />,
    );
    const cell = document.querySelector('[aria-current="date"]');
    expect(cell).toHaveClass("border", "border-foreground/10", "bg-muted/60");
  });

  describe("empty state", () => {
    it("tells the user when nothing is planned this month", () => {
      render(
        <OutfitCalendar
          year={2025}
          month={3}
          saved={[]}
          weeklyDrafts={[]}
          todayIso={TODAY}
        />,
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
          todayIso={TODAY}
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
          todayIso={TODAY}
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
              worn: false,
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
          todayIso={null}
          isPlaceholder
        />,
      );
      expect(
        screen.queryByText("No looks planned yet"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Wore this", () => {
    function savedOn(wornOn: string, worn: boolean) {
      return {
        id: GARMENT_ID,
        wornOn,
        imageUrl: null,
        name: `Look ${wornOn}`,
        occasion: "casual",
        garmentThumbs: [],
        worn,
      };
    }

    it("offers Wore this on past and current days only", () => {
      render(
        <OutfitCalendar
          todayIso={TODAY}
          year={2025}
          month={3}
          saved={[
            savedOn("2025-03-08", false),
            savedOn("2025-03-10", false),
            savedOn("2025-03-12", false),
          ]}
          weeklyDrafts={[]}
        />,
      );
      expect(
        screen.getByRole("button", { name: "Wore this on Sat, Mar 8" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Wore this on Mon, Mar 10" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Wed, Mar 12/ }),
      ).not.toBeInTheDocument();
    });

    it("marks a day worn and undoes it", async () => {
      const user = userEvent.setup();
      markDayWorn.mockResolvedValue({ ok: true });
      render(
        <OutfitCalendar
          todayIso={TODAY}
          year={2025}
          month={3}
          saved={[savedOn("2025-03-08", false), savedOn("2025-03-09", true)]}
          weeklyDrafts={[]}
        />,
      );
      await user.click(
        screen.getByRole("button", { name: "Wore this on Sat, Mar 8" }),
      );
      expect(markDayWorn).toHaveBeenCalledWith("2025-03-08", true);

      await user.click(
        screen.getByRole("button", { name: "Worn on Sun, Mar 9. Tap to undo" }),
      );
      expect(markDayWorn).toHaveBeenCalledWith("2025-03-09", false);
    });
  });

  describe("clock independence (hydration)", () => {
    /**
     * Counts reads of the current time (`new Date()` with no arguments and
     * `Date.now()`) made by the app's own code. A read during render is what
     * broke the /calendar PPR resume: the Suspense fallback depended on when
     * it was prerendered. React and the test harness read the clock too, so
     * only stacks that pass through our source files count.
     */
    function countClockReads(run: () => void) {
      const RealDate = Date;
      let reads = 0;
      const fromApp = () =>
        /\/(components|lib|app)\/(?!.*\.test\.)/.test(new Error().stack ?? "");
      class SpyDate extends RealDate {
        constructor(...args: ConstructorParameters<typeof Date>) {
          if (args.length === 0 && fromApp()) reads++;
          super(...args);
        }
        static override now() {
          if (fromApp()) reads++;
          return RealDate.now();
        }
      }
      vi.stubGlobal("Date", SpyDate);
      try {
        run();
      } finally {
        vi.unstubAllGlobals();
      }
      return reads;
    }

    it("does not read the clock when rendering the placeholder", () => {
      const reads = countClockReads(() =>
        render(
          <OutfitCalendar
            year={2026}
            month={1}
            saved={[]}
            weeklyDrafts={[]}
            todayIso={null}
            isPlaceholder
          />,
        ),
      );
      expect(reads).toBe(0);
    });

    it("does not read the clock when rendering real content", () => {
      const reads = countClockReads(() =>
        render(
          <OutfitCalendar
            year={2025}
            month={3}
            saved={[]}
            weeklyDrafts={[]}
            todayIso={TODAY}
          />,
        ),
      );
      expect(reads).toBe(0);
    });

    it("highlights nothing and offers no Wore this without a today", () => {
      render(
        <OutfitCalendar
          year={2025}
          month={3}
          saved={[
            {
              id: GARMENT_ID,
              wornOn: "2025-03-08",
              imageUrl: null,
              name: "Past look",
              occasion: "casual",
              garmentThumbs: [],
              worn: false,
            },
          ]}
          weeklyDrafts={[]}
          todayIso={null}
        />,
      );
      expect(document.querySelectorAll('[aria-current="date"]')).toHaveLength(
        0,
      );
      expect(
        screen.queryByRole("button", { name: /Wore this/ }),
      ).not.toBeInTheDocument();
    });

    it("highlights the day given by todayIso, whatever the host clock says", () => {
      render(
        <OutfitCalendar
          year={2025}
          month={3}
          saved={[]}
          weeklyDrafts={[]}
          todayIso="2025-03-21"
        />,
      );
      const current = document.querySelectorAll('[aria-current="date"]');
      expect(current).toHaveLength(1);
      expect(current[0]).toHaveTextContent(/^21/);
    });
  });
});
