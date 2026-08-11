import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/app/actions/today", () => ({
  planMyWeek: vi.fn(),
  unwearDayForUser: vi.fn(),
  wearThisFit: vi.fn(),
}));

vi.mock("@/components/outfit/generator-sheet", () => ({
  GeneratorSheet: () => null,
}));

import { DayLookView } from "@/components/outfit/day-look-view";
import type { TodayPageData } from "@/lib/outfits/today-data";

const lookA = {
  kind: "outfit" as const,
  id: "o1",
  title: "Monday outfit",
  heroImageUrl: "https://example.com/mon.jpg",
  garments: [
    {
      id: "g1",
      name: "Tee",
      imageUrl: "https://example.com/tee.jpg",
      category: "tops",
    },
  ],
};

const lookB = {
  kind: "fit" as const,
  id: "f1",
  title: "Tuesday fit",
  heroImageUrl: "https://example.com/tue.jpg",
  garments: [],
  planLookId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
};

const lookPast = {
  kind: "outfit" as const,
  id: "o0",
  title: "Sunday past",
  heroImageUrl: "https://example.com/sun.jpg",
  garments: [],
};

function baseData(overrides: Partial<TodayPageData> = {}): TodayPageData {
  return {
    todayIso: "2026-08-10",
    weekStartIso: "2026-08-09",
    garmentCount: 2,
    look: lookA,
    weekLooks: {
      "2026-08-10": lookA,
      "2026-08-11": lookB,
    },
    weekPeek: [
      {
        wornOn: "2026-08-09",
        label: "Sun",
        kind: "empty",
        heroImageUrl: null,
      },
      {
        wornOn: "2026-08-10",
        label: "Mon",
        kind: "outfit",
        heroImageUrl: lookA.heroImageUrl,
      },
      {
        wornOn: "2026-08-11",
        label: "Tue",
        kind: "fit",
        heroImageUrl: lookB.heroImageUrl,
      },
      {
        wornOn: "2026-08-12",
        label: "Wed",
        kind: "empty",
        heroImageUrl: null,
      },
      {
        wornOn: "2026-08-13",
        label: "Thu",
        kind: "empty",
        heroImageUrl: null,
      },
      {
        wornOn: "2026-08-14",
        label: "Fri",
        kind: "empty",
        heroImageUrl: null,
      },
      {
        wornOn: "2026-08-15",
        label: "Sat",
        kind: "empty",
        heroImageUrl: null,
      },
    ],
    hasWearerPhoto: true,
    ...overrides,
  };
}

describe("DayLookView", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the product date above the hero and swaps on week peek tap", async () => {
    const user = userEvent.setup();
    render(<DayLookView data={baseData()} closetGarments={[]} />);

    expect(screen.getByText("Monday, August 10")).toBeInTheDocument();
    expect(screen.getByText("Monday outfit")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Show look for Tuesday, August 11/i }),
    );

    expect(screen.getByText("Tuesday, August 11")).toBeInTheDocument();
    expect(screen.getByText("Tuesday fit")).toBeInTheDocument();
  });

  it("hides mutate CTAs for a past selected day", async () => {
    const user = userEvent.setup();
    const data = baseData({
      weekLooks: {
        "2026-08-10": lookA,
        "2026-08-09": lookPast,
      },
      weekPeek: [
        {
          wornOn: "2026-08-09",
          label: "Sun",
          kind: "outfit",
          heroImageUrl: lookPast.heroImageUrl,
        },
        {
          wornOn: "2026-08-10",
          label: "Mon",
          kind: "outfit",
          heroImageUrl: lookA.heroImageUrl,
        },
      ],
    });
    render(<DayLookView data={data} closetGarments={[]} />);

    await user.click(
      screen.getByRole("button", { name: /Show look for Sunday, August 9/i }),
    );

    expect(screen.getByText("Past look — view only.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Change look" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Unwear" }),
    ).not.toBeInTheDocument();
  });
});
