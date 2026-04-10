import type { ClothingCardData } from "@/lib/garments/types";

const HEX = /^#[0-9A-Fa-f]{6}$/i;

function normalizeText(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

export type ColorFacet = {
  id: string;
  label: string;
  /** CSS color for the swatch (hex or hsl). */
  hex: string;
};

/**
 * Stable pastel from a label so non-hex colors get distinct swatches without
 * colliding on the default card placeholder hex.
 */
function swatchFromLabelSeed(label: string): string {
  let h = 0;
  for (let i = 0; i < label.length; i++) {
    h = (h * 31 + label.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return `hsl(${hue} 38% 72%)`;
}

/**
 * Unique color facets from closet garments (DB-backed fields on each card).
 * Only uses `garment.color` when set; ignores rows with no color so placeholder
 * hex on cards does not create fake facets.
 */
export function buildColorFacetsFromGarments(
  garments: ClothingCardData[],
): ColorFacet[] {
  const map = new Map<string, ColorFacet>();

  for (const g of garments) {
    const raw = (g.color ?? "").trim();
    if (!raw) continue;

    if (HEX.test(raw)) {
      const hex = raw.toLowerCase();
      const id = `hex|${hex}`;
      if (!map.has(id)) {
        map.set(id, {
          id,
          label: hex.toUpperCase(),
          hex,
        });
      }
    } else {
      const norm = normalizeText(raw);
      if (!norm) continue;
      const id = `lbl|${norm}`;
      if (!map.has(id)) {
        map.set(id, {
          id,
          label: raw.length > 28 ? `${raw.slice(0, 26)}…` : raw,
          hex: swatchFromLabelSeed(norm),
        });
      }
    }
  }

  return [...map.values()].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
  );
}

export function garmentMatchesColorFacet(
  g: ClothingCardData,
  facetId: string,
): boolean {
  if (facetId === "all") return true;

  if (facetId.startsWith("hex|")) {
    const hex = facetId.slice(4).toLowerCase();
    const raw = (g.color ?? "").trim().toLowerCase();
    return HEX.test(raw) && raw === hex;
  }

  if (facetId.startsWith("lbl|")) {
    const key = facetId.slice(4);
    return normalizeText(g.color) === key || normalizeText(g.colorLabel) === key;
  }

  return false;
}
