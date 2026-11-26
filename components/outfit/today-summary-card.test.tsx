import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/app/actions/today", () => ({
  markDayWorn: vi.fn(),
  wearThisFit: vi.fn(),
}));

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, replace: vi.fn(), push: vi.fn() }),
}));

import { markDayWorn, wearThisFit } from "@/app/actions/today";
import { TodaySummaryCard } from "@/components/outfit/today-summary-card";
import type { TodayLook, TodaySimilarDay } from "@/lib/outfits/today-data";

const TODAY = "2026-11-26";

const outfit: TodayLook = {
  kind: "outfit",
  id: "o1",
  title: "Rainy navy",
  heroImageUrl: "https://example.com/navy.jpg",
  garments: [],
  worn: false,
};

const fit: TodayLook = {
  kind: "fit",
  id: "f1",
  title: "Suggested khaki",
  heroImageUrl: null,
  garments: [],
  planLookId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
};

const similar: TodaySimilarDay = {
  wornOn: "2026-11-12",
  outfitId: "o0",
  title: "Trench and denim",
  heroImageUrl: "https://example.com/trench.jpg",
  garments: [],
  weather: "rain · 50° / 41°",
};

function renderCard(
  props: Partial<Parameters<typeof TodaySummaryCard>[0]> = {},
) {
  return render(
    <TodaySummaryCard
      todayIso={TODAY}
      weatherLine="New York, NY · 50° rain"
      look={outfit}
      lastSimilarDay={similar}
      {...props}
    />,
  );
}

describe("TodaySummaryCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    cleanup();
  });

  it("shows today's outfit, weather, and the last similar-weather day", () => {
    renderCard();
    const card = screen.getByRole("region", { name: "Today" });
    expect(within(card).getByText("New York, NY · 50° rain")).toBeVisible();
    expect(within(card).getByText("Rainy navy")).toBeVisible();
    expect(within(card).getByText("Trench and denim")).toBeVisible();
    expect(within(card).getByText(/rain · 50° \/ 41°/)).toBeVisible();
  });

  it("marks today's Outfit worn", async () => {
    vi.mocked(markDayWorn).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole("button", { name: /^Wore this on/ }));

    expect(markDayWorn).toHaveBeenCalledWith(TODAY, true);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("shows Worn when today's Outfit is already confirmed", () => {
    renderCard({ look: { ...outfit, worn: true } });
    expect(
      screen.getByRole("button", { name: /^Worn on .* Tap to undo$/ }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("commits today's Fit, then marks it worn", async () => {
    vi.mocked(wearThisFit).mockResolvedValue({ ok: true });
    vi.mocked(markDayWorn).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    renderCard({ look: fit });

    await user.click(screen.getByRole("button", { name: /^Wore this on/ }));

    await waitFor(() => expect(markDayWorn).toHaveBeenCalledWith(TODAY, true));
    expect(wearThisFit).toHaveBeenCalledWith(fit.planLookId);
    expect(
      vi.mocked(wearThisFit).mock.invocationCallOrder[0]!,
    ).toBeLessThan(vi.mocked(markDayWorn).mock.invocationCallOrder[0]!);
  });

  it("does not mark worn when committing the Fit fails", async () => {
    vi.mocked(wearThisFit).mockResolvedValue({
      ok: false,
      message: "Could not save.",
    });
    const user = userEvent.setup();
    renderCard({ look: fit });

    await user.click(screen.getByRole("button", { name: /^Wore this on/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not save.",
    );
    expect(markDayWorn).not.toHaveBeenCalled();
  });

  it("handles no look and no similar day", () => {
    renderCard({ look: null, lastSimilarDay: null });
    expect(screen.getByText("No look for today yet")).toBeVisible();
    expect(
      screen.getByText("Nothing worn on a day like this yet."),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Wore this/ }),
    ).not.toBeInTheDocument();
  });
});
