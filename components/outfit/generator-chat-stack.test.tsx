import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { GeneratorChatStack } from "@/components/outfit/generator-chat-stack";
import type { ClothingCardData } from "@/lib/garments/types";
import type { OutfitLook } from "@/lib/outfits/types";

const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const garments: ClothingCardData[] = [
  {
    id: "g-top",
    name: "Crepe Dolman Sweater",
    category: "tops",
    imageUrl: "https://example.com/sweater.jpg",
  },
  {
    id: "g-cami",
    name: "Satin Lace Cami",
    category: "tops",
    imageUrl: "https://example.com/cami.jpg",
  },
];

function look(
  id: string,
  title: string,
  garmentIds: string[],
): OutfitLook {
  return {
    id,
    title,
    description: `${title} description`,
    tags: ["day"],
    garmentIds,
    imageDataUrl: PIXEL,
  };
}

const looks: OutfitLook[] = [
  look("look-a", "Gallery navy", ["g-top", "g-cami"]),
  look("look-b", "Travel khaki", ["g-top"]),
  look("look-c", "Ruby evening", ["g-cami"]),
];

describe("GeneratorChatStack", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });
  it("renders a stacked deck with photo count and included pieces", () => {
    render(
      <GeneratorChatStack
        messageId="m1"
        looks={looks}
        approvedLookId={null}
        onApprove={vi.fn()}
        onRemix={vi.fn()}
        closetGarments={garments}
      />,
    );

    expect(screen.getByText("3 Photos")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Gallery navy" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Your look includes:")).toHaveLength(3);
    expect(screen.getAllByText("Crepe Dolman Sweater").length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByRole("button", { name: "Approve" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Gallery navy outfit preview" }),
    ).toBeInTheDocument();
  });

  it("brings a peeking card to the front", async () => {
    const user = userEvent.setup();
    render(
      <GeneratorChatStack
        messageId="m1"
        looks={looks}
        approvedLookId={null}
        onApprove={vi.fn()}
        onRemix={vi.fn()}
        closetGarments={garments}
      />,
    );

    const stage = screen.getByRole("region", {
      name: "Generated outfit looks",
    });
    await user.click(
      screen.getByRole("button", { name: "Show look 2: Travel khaki" }),
    );

    expect(
      screen.getByRole("heading", { name: "Travel khaki" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Look 2 of 3: Travel khaki/),
    ).toBeInTheDocument();
    expect(stage).toHaveFocus();
  });

  it("advances with the keyboard", async () => {
    const user = userEvent.setup();
    render(
      <GeneratorChatStack
        messageId="m1"
        looks={looks}
        approvedLookId={null}
        onApprove={vi.fn()}
        onRemix={vi.fn()}
        closetGarments={garments}
      />,
    );

    const stage = screen.getByRole("region", {
      name: "Generated outfit looks",
    });
    stage.focus();
    await user.keyboard("{ArrowRight}");

    expect(
      screen.getByText(/Look 2 of 3: Travel khaki/),
    ).toBeInTheDocument();
  });

  it("does not navigate when arrow keys originate from an action", async () => {
    const user = userEvent.setup();
    render(
      <GeneratorChatStack
        messageId="m1"
        looks={looks}
        approvedLookId={null}
        onApprove={vi.fn()}
        onRemix={vi.fn()}
        closetGarments={garments}
      />,
    );

    screen.getByRole("button", { name: "Approve" }).focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("button", { name: "Approve" })).toHaveFocus();
    expect(screen.getByText(/Look 1 of 3: Gallery navy/)).toBeInTheDocument();
  });

  it("preserves previous motion direction with two looks", () => {
    render(
      <GeneratorChatStack
        messageId="m1"
        looks={looks.slice(0, 2)}
        approvedLookId={null}
        onApprove={vi.fn()}
        onRemix={vi.fn()}
        closetGarments={garments}
      />,
    );

    const stage = screen.getByRole("region", {
      name: "Generated outfit looks",
    });
    const frontCard = stage.querySelector<HTMLElement>(
      '[data-look-card="look-a"]',
    );
    stage.focus();
    fireEvent.keyDown(stage, { key: "ArrowLeft" });

    expect(frontCard?.style.transform).toContain("translate3d(18%");
    expect(screen.getByText(/Look 2 of 2: Travel khaki/)).toBeInTheDocument();
  });

  it("restores the deck without switching when a drag is canceled", () => {
    render(
      <GeneratorChatStack
        messageId="m1"
        looks={looks}
        approvedLookId={null}
        onApprove={vi.fn()}
        onRemix={vi.fn()}
        closetGarments={garments}
      />,
    );

    const stage = screen.getByRole("region", {
      name: "Generated outfit looks",
    });
    const frontCard = stage.querySelector<HTMLElement>(
      '[data-look-card="look-a"]',
    );
    expect(frontCard).not.toBeNull();

    fireEvent.pointerDown(stage, {
      pointerId: 1,
      button: 0,
      clientX: 120,
      clientY: 100,
    });
    fireEvent.pointerMove(stage, {
      pointerId: 1,
      clientX: 40,
      clientY: 100,
    });
    expect(stage).toHaveAttribute("data-dragging");

    fireEvent.pointerCancel(stage, {
      pointerId: 1,
      clientX: 0,
      clientY: 100,
    });

    expect(stage).not.toHaveAttribute("data-dragging");
    expect(frontCard?.style.transform).toBe(
      "translate3d(0px, 0px, 0) scale(1)",
    );
    expect(screen.getByText(/Look 1 of 3: Gallery navy/)).toBeInTheDocument();
  });

  it("approves the visible look", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    render(
      <GeneratorChatStack
        messageId="m1"
        looks={looks}
        approvedLookId={null}
        onApprove={onApprove}
        onRemix={vi.fn()}
        closetGarments={garments}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(onApprove).toHaveBeenCalledWith("m1", looks[0]);
  });
});
