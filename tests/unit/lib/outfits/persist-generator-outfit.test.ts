import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  requireSql: vi.fn(),
}));

import { requireSql } from "@/lib/db";
import {
  approveGeneratorPayloadSchema,
  executeApproveGeneratorOutfit,
  insertOutfitWithGarments,
} from "@/lib/outfits/persist-generator-outfit";

const sqlRequire = vi.mocked(requireSql);

describe("approveGeneratorPayloadSchema", () => {
  const gid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  it("parses valid payload", () => {
    const parsed = approveGeneratorPayloadSchema.safeParse({
      wornOn: "2025-01-01",
      garmentIds: [gid],
      occasion: "casual",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid date", () => {
    const parsed = approveGeneratorPayloadSchema.safeParse({
      wornOn: "01-01-2025",
      garmentIds: [gid],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects empty garmentIds", () => {
    const parsed = approveGeneratorPayloadSchema.safeParse({
      wornOn: "2025-01-01",
      garmentIds: [],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("insertOutfitWithGarments", () => {
  it("inserts outfit and garment links", async () => {
    const gid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    const outfitId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ id: outfitId }])
      .mockResolvedValue(undefined);
    sqlRequire.mockReturnValue(sql as never);
    const id = await insertOutfitWithGarments({
      wornOn: "2025-01-01",
      name: "Test",
      occasion: "casual",
      imageUrl: null,
      garmentIds: [gid],
    });
    expect(id).toBe(outfitId);
    expect(sql).toHaveBeenCalled();
  });
});

describe("executeApproveGeneratorOutfit", () => {
  it("returns missing garments when count mismatch", async () => {
    const gid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    const sql = vi.fn().mockResolvedValueOnce([{ n: 0 }]);
    sqlRequire.mockReturnValue(sql as never);
    const res = await executeApproveGeneratorOutfit({
      wornOn: "2025-01-01",
      garmentIds: [gid],
      occasion: "casual",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("missing");
  });
});
