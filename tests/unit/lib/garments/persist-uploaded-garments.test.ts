import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/gemini-provider", () => ({
  hasGeminiCredentials: vi.fn(),
}));

vi.mock("@/lib/ai/garments/describe-from-image", () => ({
  analyzeGarmentFromImageUrl: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  requireSql: vi.fn(),
}));

import { hasGeminiCredentials } from "@/lib/ai/gemini-provider";
import { requireSql } from "@/lib/db";
import { persistUploadedGarmentItems } from "@/lib/garments/persist-uploaded-garments";

const hasGemini = vi.mocked(hasGeminiCredentials);
const requireSqlMock = vi.mocked(requireSql);

describe("persistUploadedGarmentItems", () => {
  beforeEach(() => {
    hasGemini.mockReset();
    requireSqlMock.mockReset();
  });

  it("returns ok for empty items", async () => {
    const res = await persistUploadedGarmentItems([]);
    expect(res.ok).toBe(true);
  });

  it("returns error when url missing", async () => {
    const res = await persistUploadedGarmentItems([
      {
        url: "   ",
        key: "k",
        name: "n",
        category: "tops",
      },
    ]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("URL");
  });

  it("returns error for invalid category", async () => {
    const res = await persistUploadedGarmentItems([
      {
        url: "https://x.com/a.jpg",
        key: "k",
        name: "n",
        category: "invalid" as "tops",
      },
    ]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("Invalid category");
  });

  it("inserts without Gemini when credentials missing", async () => {
    hasGemini.mockReturnValue(false);
    const sql = vi.fn().mockResolvedValue(undefined);
    requireSqlMock.mockReturnValue(sql as never);
    const res = await persistUploadedGarmentItems([
      {
        url: "https://x.com/a.jpg",
        key: "k",
        name: "n",
        category: "tops",
      },
    ]);
    expect(res.ok).toBe(true);
    expect(sql).toHaveBeenCalled();
  });
});
