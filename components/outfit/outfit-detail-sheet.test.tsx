import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

vi.mock("@/app/actions/outfits", () => ({
  getTodaysOutfitId: vi.fn(),
  renameOutfit: vi.fn(),
  wearOutfitToday: vi.fn(),
}));

import { OutfitDetailSheet } from "@/components/outfit/outfit-detail-sheet";
import type { ClosetSavedOutfit } from "@/lib/outfits/closet-saved-outfits";

const MEDIA_PATH = "/api/media/6f1c3f1e-2b7a-4c3d-8e9f-1a2b3c4d5e6f";

function outfitWith(
  overrides: Partial<ClosetSavedOutfit> = {},
): ClosetSavedOutfit {
  return {
    id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    wornOn: "2026-08-10",
    imageUrl: null,
    fallbackGarmentImageUrl: null,
    name: "Monday",
    occasion: "casual",
    garmentIds: [],
    ...overrides,
  } as ClosetSavedOutfit;
}

/** The sheet renders in a portal, so query the whole document. */
function heroImage(): HTMLImageElement {
  const hero = document.querySelector("img");
  if (!hero) throw new Error("hero image was not rendered");
  return hero as HTMLImageElement;
}

afterEach(() => {
  cleanup();
});

describe("OutfitDetailSheet hero image", () => {
  /**
   * The Next image optimizer fetches same-origin sources server-side without
   * the caller's cookies, so /api/media/{id} would 401 and render broken.
   */
  it("bypasses the image optimizer for a private media hero", () => {
    render(
      <OutfitDetailSheet
        outfit={outfitWith({ fallbackGarmentImageUrl: MEDIA_PATH })}
        garments={[]}
        onOpenChange={() => {}}
        onRenamed={() => {}}
      />,
    );

    const hero = heroImage();
    expect(hero).toHaveAttribute("src", MEDIA_PATH);
    expect(hero).toHaveAttribute("data-unoptimized", "true");
  });

  it("bypasses the image optimizer for a generated data-url hero", () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgo=";
    render(
      <OutfitDetailSheet
        outfit={outfitWith({ imageUrl: dataUrl })}
        garments={[]}
        onOpenChange={() => {}}
        onRenamed={() => {}}
      />,
    );

    expect(heroImage()).toHaveAttribute("data-unoptimized", "true");
  });

  it("still optimizes a durable remote hero", () => {
    render(
      <OutfitDetailSheet
        outfit={outfitWith({ imageUrl: "https://images.unsplash.com/photo" })}
        garments={[]}
        onOpenChange={() => {}}
        onRenamed={() => {}}
      />,
    );

    expect(heroImage()).toHaveAttribute("data-unoptimized", "false");
  });
});
