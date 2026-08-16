import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  requireSql: vi.fn(),
}));

vi.mock("@/lib/time/product-timezone", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/time/product-timezone")>();
  return {
    ...actual,
    productTodayIso: vi.fn(() => "2026-08-10"),
  };
});

import { requireSql } from "@/lib/db";
import {
  approveGeneratorPayloadSchema,
  commitOutfitForDay,
  executeApproveGeneratorOutfit,
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

describe("commitOutfitForDay", () => {
  it("creates a new outfit when the garment set is new", async () => {
    const gid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    const outfitId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    const sql = vi
      .fn()
      // find existing by key → none
      .mockResolvedValueOnce([])
      // insert outfit
      .mockResolvedValueOnce([{ id: outfitId }])
      // insert garment link
      .mockResolvedValueOnce(undefined)
      // replaceWearForDay (no prior)
      .mockResolvedValueOnce([])
      // syncLastWorn
      .mockResolvedValueOnce(undefined);
    sqlRequire.mockReturnValue(sql as never);

    const id = await commitOutfitForDay({
      userId: "u1",
      wornOn: "2025-01-01",
      garmentIds: [gid],
      imageUrl: null,
      occasion: "casual",
    });
    expect(id).toBe(outfitId);
    expect(sql).toHaveBeenCalled();
  });

  it("reuses an existing outfit for the same garment set", async () => {
    const gid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    const outfitId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    const sql = vi
      .fn()
      .mockResolvedValueOnce([{ id: outfitId }])
      // replaceWearForDay
      .mockResolvedValueOnce([])
      // syncLastWorn
      .mockResolvedValueOnce(undefined);
    sqlRequire.mockReturnValue(sql as never);

    const id = await commitOutfitForDay({
      userId: "u1",
      wornOn: "2025-01-08",
      garmentIds: [gid],
      imageUrl: null,
    });
    expect(id).toBe(outfitId);
  });
});

describe("executeApproveGeneratorOutfit", () => {
  it("returns missing garments when count mismatch", async () => {
    const gid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    const sql = vi.fn().mockResolvedValueOnce([{ n: 0 }]);
    sqlRequire.mockReturnValue(sql as never);
    const res = await executeApproveGeneratorOutfit("u1", {
      wornOn: "2026-08-10",
      garmentIds: [gid],
      occasion: "casual",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("missing");
  });

  it("rejects past wornOn without querying garments", async () => {
    const gid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    const sql = vi.fn();
    sqlRequire.mockReturnValue(sql as never);
    const res = await executeApproveGeneratorOutfit("u1", {
      wornOn: "2026-08-09",
      garmentIds: [gid],
      occasion: "casual",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/past/i);
    expect(sql).not.toHaveBeenCalled();
  });
});
