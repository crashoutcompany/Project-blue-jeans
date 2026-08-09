import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/gemini-provider", () => ({
  hasGeminiCredentials: vi.fn(),
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

import { hasGeminiCredentials } from "@/lib/ai/gemini-provider";
import { loadGarmentCatalog } from "@/lib/garments/load-catalog";
import { runStep1PlanWithRetry } from "@/lib/ai/lookbook/step1-retry";
import { generateLookbook } from "@/lib/lookbook/generate-lookbook";

const hasGemini = vi.mocked(hasGeminiCredentials);
const loadCatalog = vi.mocked(loadGarmentCatalog);
const step1 = vi.mocked(runStep1PlanWithRetry);

describe("generateLookbook", () => {
  beforeEach(() => {
    hasGemini.mockReset();
    loadCatalog.mockReset();
    step1.mockReset();
  });

  it("returns error when Vertex credentials missing", async () => {
    hasGemini.mockReturnValue(false);
    const res = await generateLookbook({ userId: "u1", narrative: "x" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("Vertex");
  });

  it("returns error when closet empty", async () => {
    hasGemini.mockReturnValue(true);
    loadCatalog.mockResolvedValue([]);
    const res = await generateLookbook({ userId: "u1", narrative: "x" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("empty");
  });

  it("returns ok when plan succeeds and skips hero", async () => {
    hasGemini.mockReturnValue(true);
    loadCatalog.mockResolvedValue([
      {
        id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
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
          garmentIds: ["f47ac10b-58cc-4372-a567-0e02b2c3d479"],
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
});
