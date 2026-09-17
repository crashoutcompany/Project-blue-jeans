import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/credentials/resolve", () => ({
  resolveGeminiApiKey: vi.fn(),
}));

vi.mock("@/lib/garments/load-catalog", () => ({
  loadGarmentCatalog: vi.fn(),
  loadGarmentsByIds: vi.fn(),
}));

vi.mock("@/lib/ai/lookbook/step1-retry", () => ({
  runStep1PlanWithRetry: vi.fn(),
}));

vi.mock("@/lib/ai/lookbook/step2-image", () => ({
  runHeroImageStep: vi.fn(),
}));

vi.mock("@/lib/wearer/profile", () => ({
  getWearerPhoto: vi.fn(),
}));

vi.mock("@/lib/wearer/preferences", () => ({
  getWearerLocation: vi.fn(),
}));

vi.mock("@/lib/outfits/day-looks-in-range", () => ({
  loadOutfitsInRange: vi.fn(),
}));

vi.mock("@/lib/outfits/existing-outfit-heroes", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/outfits/existing-outfit-heroes")>();
  return {
    ...actual,
    findExistingOutfitHeroUrls: vi.fn(),
  };
});

import { resolveGeminiApiKey } from "@/lib/credentials/resolve";
import {
  loadGarmentCatalog,
  loadGarmentsByIds,
} from "@/lib/garments/load-catalog";
import { runStep1PlanWithRetry } from "@/lib/ai/lookbook/step1-retry";
import { runHeroImageStep } from "@/lib/ai/lookbook/step2-image";
import { getWearerPhoto } from "@/lib/wearer/profile";
import { getWearerLocation } from "@/lib/wearer/preferences";
import { loadOutfitsInRange } from "@/lib/outfits/day-looks-in-range";
import { findExistingOutfitHeroUrls } from "@/lib/outfits/existing-outfit-heroes";
import { garmentSetKey } from "@/lib/outfits/garment-set-key";
import { generateLookbook } from "@/lib/lookbook/generate-lookbook";

const resolveGemini = vi.mocked(resolveGeminiApiKey);
const loadCatalog = vi.mocked(loadGarmentCatalog);
const loadByIds = vi.mocked(loadGarmentsByIds);
const step1 = vi.mocked(runStep1PlanWithRetry);
const hero = vi.mocked(runHeroImageStep);
const wearerPhoto = vi.mocked(getWearerPhoto);
const wearerLocation = vi.mocked(getWearerLocation);
const outfitsInRange = vi.mocked(loadOutfitsInRange);
const existingHeroes = vi.mocked(findExistingOutfitHeroUrls);

const GID_A = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const GID_B = "b47ac10b-58cc-4372-a567-0e02b2c3d479";
const GID_C = "c47ac10b-58cc-4372-a567-0e02b2c3d479";
const GID_D = "d47ac10b-58cc-4372-a567-0e02b2c3d479";

function garment(
  id: string,
  name: string,
  category: "tops" | "bottoms" | "shoes",
) {
  return {
    id,
    name,
    category,
    color: null,
    notes: null,
    description: name,
  };
}

const closet = [
  garment(GID_A, "Tee", "tops"),
  garment(GID_B, "Jeans", "bottoms"),
  garment(GID_C, "Sneakers", "shoes"),
  garment(GID_D, "Oxford", "tops"),
];

const lookStackA = [GID_A, GID_B, GID_C];
const lookStackB = [GID_D, GID_B, GID_C];

describe("generateLookbook", () => {
  beforeEach(() => {
    resolveGemini.mockReset();
    loadCatalog.mockReset();
    loadByIds.mockReset();
    step1.mockReset();
    hero.mockReset();
    wearerPhoto.mockReset();
    wearerLocation.mockReset();
    outfitsInRange.mockReset();
    existingHeroes.mockReset();
    existingHeroes.mockResolvedValue(new Map());
    wearerLocation.mockResolvedValue(null);
    outfitsInRange.mockResolvedValue([]);
  });

  it("returns error when Gemini credentials missing", async () => {
    resolveGemini.mockResolvedValue({
      ok: false,
      message: "Connect Google AI Studio in Settings before using this feature.",
    });
    const res = await generateLookbook({ userId: "u1", narrative: "x" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("Google AI Studio");
  });

  it("returns error when closet empty", async () => {
    resolveGemini.mockResolvedValue({ ok: true, apiKey: "gemini-key" });
    loadCatalog.mockResolvedValue([]);
    const res = await generateLookbook({ userId: "u1", narrative: "x" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("empty");
  });

  it("returns ok when plan succeeds and skips hero", async () => {
    resolveGemini.mockResolvedValue({ ok: true, apiKey: "gemini-key" });
    loadCatalog.mockResolvedValue(closet);
    step1.mockResolvedValue({
      looks: [
        {
          title: "One",
          description: "d",
          tags: ["daytime"],
          garmentIds: lookStackA,
        },
      ],
      curatorNote: "note",
    });
    const res = await generateLookbook({
      userId: "u1",
      narrative: "Brunch",
      skipHeroImage: true,
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.looks.length).toBeGreaterThan(0);
    expect(step1).toHaveBeenCalledWith(
      expect.objectContaining({ location: "New York, NY" }),
    );
  });

  it("keeps ok when hero images partially fail", async () => {
    resolveGemini.mockResolvedValue({ ok: true, apiKey: "gemini-key" });
    loadCatalog.mockResolvedValue(closet);
    step1.mockResolvedValue({
      looks: [
        {
          title: "Look A",
          description: "a",
          tags: ["daytime"],
          garmentIds: lookStackA,
        },
        {
          title: "Look B",
          description: "b",
          tags: ["evening"],
          garmentIds: lookStackB,
        },
      ],
      curatorNote: "note",
    });
    wearerPhoto.mockResolvedValue(null);
    loadByIds.mockImplementation(async (_userId, ids) =>
      ids.map((id) => {
        const g = closet.find((row) => row.id === id);
        return {
          id,
          name: g?.name ?? id,
          category: g?.category ?? "tops",
          color: null,
          notes: null,
          description: null,
          image_url: `https://example.com/${id}.jpg`,
        };
      }),
    );
    hero
      .mockRejectedValueOnce(new Error("hero failed"))
      .mockResolvedValueOnce("data:image/png;base64,ok");

    const res = await generateLookbook({
      userId: "u1",
      narrative: "Night out",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.looks).toHaveLength(2);
    expect(res.looks[0]?.imageDataUrl).toBeUndefined();
    expect(res.looks[1]?.imageDataUrl).toBe("data:image/png;base64,ok");
  });

  it("reuses a stored Outfit hero instead of generating a new image", async () => {
    const savedUrl = "https://cdn.example.com/saved-outfit.jpg";
    resolveGemini.mockResolvedValue({ ok: true, apiKey: "gemini-key" });
    loadCatalog.mockResolvedValue(closet);
    step1.mockResolvedValue({
      looks: [
        {
          title: "Known look",
          description: "a",
          tags: ["daytime"],
          garmentIds: lookStackA,
        },
        {
          title: "New look",
          description: "b",
          tags: ["evening"],
          garmentIds: lookStackB,
        },
      ],
      curatorNote: "note",
    });
    existingHeroes.mockResolvedValue(
      new Map([[garmentSetKey(lookStackA), savedUrl]]),
    );
    wearerPhoto.mockResolvedValue(null);
    loadByIds.mockImplementation(async (_userId, ids) =>
      ids.map((id) => {
        const g = closet.find((row) => row.id === id);
        return {
          id,
          name: g?.name ?? id,
          category: g?.category ?? "tops",
          color: null,
          notes: null,
          description: null,
          image_url: `https://example.com/${id}.jpg`,
        };
      }),
    );
    hero.mockResolvedValue("data:image/png;base64,new");

    const res = await generateLookbook({
      userId: "u1",
      narrative: "Reuse when possible",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.looks[0]?.imageDataUrl).toBe(savedUrl);
    expect(res.looks[1]?.imageDataUrl).toBe("data:image/png;base64,new");
    expect(hero).toHaveBeenCalledTimes(1);
    expect(loadByIds).toHaveBeenCalledTimes(1);
    expect(loadByIds.mock.calls[0]?.[1]).toEqual(lookStackB);
  });

  it("omits committed Outfit tops from the catalog", async () => {
    resolveGemini.mockResolvedValue({ ok: true, apiKey: "gemini-key" });
    loadCatalog.mockResolvedValue(closet);
    outfitsInRange.mockResolvedValue([
      {
        wornOn: "2026-09-14",
        id: "11111111-1111-4111-8111-111111111111",
        name: null,
        imageUrl: null,
        occasion: "casual",
        garmentIds: [GID_A],
      },
    ]);
    step1.mockResolvedValue({
      looks: [
        {
          title: "One",
          description: "d",
          tags: ["daytime"],
          garmentIds: lookStackB,
        },
      ],
      curatorNote: "note",
    });

    const res = await generateLookbook({
      userId: "u1",
      narrative: "Brunch",
      skipHeroImage: true,
    });

    expect(res.ok).toBe(true);
    const validIds = step1.mock.calls[0]![0].validIds;
    expect(validIds.has(GID_A)).toBe(false);
    expect(validIds.has(GID_D)).toBe(true);
  });

  it("rejects pinning a top already on a committed Outfit", async () => {
    resolveGemini.mockResolvedValue({ ok: true, apiKey: "gemini-key" });
    loadCatalog.mockResolvedValue(closet);
    outfitsInRange.mockResolvedValue([
      {
        wornOn: "2026-09-14",
        id: "11111111-1111-4111-8111-111111111111",
        name: null,
        imageUrl: null,
        occasion: "casual",
        garmentIds: [GID_A],
      },
    ]);

    const res = await generateLookbook({
      userId: "u1",
      narrative: "Brunch",
      skipHeroImage: true,
      includedGarmentIds: [GID_A],
    });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/committed Outfit/i);
    expect(step1).not.toHaveBeenCalled();
  });

  it("rejects a planned look that is missing a bottom or shoes", async () => {
    resolveGemini.mockResolvedValue({ ok: true, apiKey: "gemini-key" });
    loadCatalog.mockResolvedValue(closet);
    step1.mockResolvedValue({
      looks: [
        {
          title: "One",
          description: "d",
          tags: ["daytime"],
          garmentIds: [GID_A],
        },
      ],
      curatorNote: "note",
    });

    const res = await generateLookbook({
      userId: "u1",
      narrative: "Brunch",
      skipHeroImage: true,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toBe("Each look needs a bottom.");
  });

  it("rejects duplicate Include ids before planning", async () => {
    resolveGemini.mockResolvedValue({ ok: true, apiKey: "gemini-key" });
    loadCatalog.mockResolvedValue(closet);

    const res = await generateLookbook({
      userId: "u1",
      narrative: "Brunch",
      skipHeroImage: true,
      includedGarmentIds: [GID_A, GID_A],
    });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toBe("Include the same piece only once.");
    expect(step1).not.toHaveBeenCalled();
  });

  it("stops when this week's Outfits cannot be loaded", async () => {
    resolveGemini.mockResolvedValue({ ok: true, apiKey: "gemini-key" });
    loadCatalog.mockResolvedValue(closet);
    outfitsInRange.mockRejectedValue(new Error("db down"));

    const res = await generateLookbook({
      userId: "u1",
      narrative: "Brunch",
      skipHeroImage: true,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/this week's Outfits/i);
    expect(step1).not.toHaveBeenCalled();
  });
});
