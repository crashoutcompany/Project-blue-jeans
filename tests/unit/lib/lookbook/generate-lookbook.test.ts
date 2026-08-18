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

import { resolveGeminiApiKey } from "@/lib/credentials/resolve";
import {
  loadGarmentCatalog,
  loadGarmentsByIds,
} from "@/lib/garments/load-catalog";
import { runStep1PlanWithRetry } from "@/lib/ai/lookbook/step1-retry";
import { runHeroImageStep } from "@/lib/ai/lookbook/step2-image";
import { getWearerPhoto } from "@/lib/wearer/profile";
import { generateLookbook } from "@/lib/lookbook/generate-lookbook";

const resolveGemini = vi.mocked(resolveGeminiApiKey);
const loadCatalog = vi.mocked(loadGarmentCatalog);
const loadByIds = vi.mocked(loadGarmentsByIds);
const step1 = vi.mocked(runStep1PlanWithRetry);
const hero = vi.mocked(runHeroImageStep);
const wearerPhoto = vi.mocked(getWearerPhoto);

const GID_A = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const GID_B = "b47ac10b-58cc-4372-a567-0e02b2c3d479";

describe("generateLookbook", () => {
  beforeEach(() => {
    resolveGemini.mockReset();
    loadCatalog.mockReset();
    loadByIds.mockReset();
    step1.mockReset();
    hero.mockReset();
    wearerPhoto.mockReset();
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
    loadCatalog.mockResolvedValue([
      {
        id: GID_A,
        name: "Tee",
        category: "tops",
        color: null,
        notes: null,
        description: "A tee",
      },
    ]);
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
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.looks.length).toBeGreaterThan(0);
  });

  it("keeps ok when hero images partially fail", async () => {
    resolveGemini.mockResolvedValue({ ok: true, apiKey: "gemini-key" });
    loadCatalog.mockResolvedValue([
      {
        id: GID_A,
        name: "Tee",
        category: "tops",
        color: null,
        notes: null,
        description: "A tee",
      },
      {
        id: GID_B,
        name: "Jeans",
        category: "bottoms",
        color: null,
        notes: null,
        description: "Jeans",
      },
    ]);
    step1.mockResolvedValue({
      looks: [
        {
          title: "Look A",
          description: "a",
          tags: ["daytime"],
          garmentIds: [GID_A],
        },
        {
          title: "Look B",
          description: "b",
          tags: ["evening"],
          garmentIds: [GID_B],
        },
      ],
      curatorNote: "note",
    });
    wearerPhoto.mockResolvedValue(null);
    loadByIds.mockImplementation(async (_userId, ids) =>
      ids.map((id) => ({
        id,
        name: id === GID_A ? "Tee" : "Jeans",
        category: id === GID_A ? "tops" : "bottoms",
        color: null,
        notes: null,
        description: null,
        image_url: `https://example.com/${id}.jpg`,
      })),
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
});
