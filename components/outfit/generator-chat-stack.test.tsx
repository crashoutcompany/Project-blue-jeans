import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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

    await user.click(
      screen.getByRole("button", { name: "Show look 2: Travel khaki" }),
    );

    expect(
      screen.getByRole("heading", { name: "Travel khaki" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Look 2 of 3: Travel khaki/),
    ).toBeInTheDocument();
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
