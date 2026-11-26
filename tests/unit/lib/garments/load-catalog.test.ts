import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/garments/get-closet-garments-cached", () => ({
  getAllGarmentRowsCached: vi.fn(),
}));

import { getAllGarmentRowsCached } from "@/lib/garments/get-closet-garments-cached";
import { loadGarmentCatalog } from "@/lib/garments/load-catalog";
import { garmentRowToCardData, type GarmentRow } from "@/lib/garments/map-row";

function row(id: string, retiredAt: string | null): GarmentRow {
  return {
    id,
    image_url: `https://cdn.example.com/${id}.jpg`,
    uploadthing_key: null,
    media_asset_id: null,
    category: "tops",
    color: null,
    is_favorite: false,
    name: id,
    notes: null,
    description: null,
    retired_at: retiredAt,
  };
}

describe("loadGarmentCatalog", () => {
  it("leaves retired pieces out of AI planning", async () => {
    vi.mocked(getAllGarmentRowsCached).mockResolvedValue([
      row("active", null),
      row("retired", "2026-11-20T12:00:00Z"),
    ]);

    const catalog = await loadGarmentCatalog("u1");

    expect(catalog.map((g) => g.id)).toEqual(["active"]);
  });
});

describe("garmentRowToCardData", () => {
  it("marks a row with retired_at as retired", () => {
    expect(garmentRowToCardData(row("a", null)).retired).toBe(false);
    expect(
      garmentRowToCardData(row("b", "2026-11-20T12:00:00Z")).retired,
    ).toBe(true);
  });
});
