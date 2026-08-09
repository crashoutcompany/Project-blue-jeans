import { describe, expect, it } from "vitest";

import {
  buildColorFacetsFromGarments,
  garmentMatchesColorFacet,
} from "@/lib/garments/color-facets";
import type { ClothingCardData } from "@/lib/garments/types";

describe("buildColorFacetsFromGarments", () => {
  it("builds hex facets from #rrggbb colors", () => {
    const garments: ClothingCardData[] = [
      { id: "1", name: "a", category: "tops", color: "#FF00AA" },
    ];
    const facets = buildColorFacetsFromGarments(garments);
    expect(facets.some((f) => f.id.startsWith("hex|"))).toBe(true);
  });

  it("matches label facet", () => {
    const g: ClothingCardData = {
      id: "1",
      name: "a",
      category: "tops",
      color: "Navy",
    };
    expect(garmentMatchesColorFacet(g, "lbl|navy")).toBe(true);
  });

  it("all matches any garment", () => {
    const g: ClothingCardData = {
      id: "1",
      name: "a",
      category: "tops",
    };
    expect(garmentMatchesColorFacet(g, "all")).toBe(true);
  });
});
