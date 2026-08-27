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

  it("rejects impossible calendar dates", () => {
    const parsed = approveGeneratorPayloadSchema.safeParse({
      wornOn: "2026-02-30",
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
  const gid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
  const gid2 = "c9bf9e57-1685-4c89-bafb-ff5af830be8a";
  const outfitId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

  /** commit statement, replaceWearForDay, syncLastWorn */
  function commitSql() {
    return vi
      .fn()
      .mockResolvedValueOnce([{ id: outfitId }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(undefined);
  }

  function sqlTextOf(sql: ReturnType<typeof commitSql>, call: number): string {
    const strings = sql.mock.calls[call]?.[0] as TemplateStringsArray;
    return strings.join(" ");
  }

  it("returns the committed outfit id", async () => {
    const sql = commitSql();
    sqlRequire.mockReturnValue(sql as never);

    const id = await commitOutfitForDay({
      userId: "u1",
      wornOn: "2025-01-01",
      garmentIds: [gid],
      imageUrl: null,
      occasion: "casual",
    });
    expect(id).toBe(outfitId);
  });

  /**
   * A select-then-insert raced outfits_user_garment_set_key_uidx, and linking
   * pieces in a follow-up loop could leave a partially linked outfit.
   */
  it("writes the outfit and its garment links in one statement", async () => {
    const sql = commitSql();
    sqlRequire.mockReturnValue(sql as never);

    await commitOutfitForDay({
      userId: "u1",
      wornOn: "2025-01-01",
      garmentIds: [gid, gid2],
      imageUrl: "hero",
    });

    const commit = sqlTextOf(sql, 0);
    expect(commit).toContain("INSERT INTO outfits");
    expect(commit).toContain("ON CONFLICT (user_id, garment_set_key)");
    expect(commit).toContain("INSERT INTO outfit_garments");
    // No separate per-garment insert: the commit plus wear replacement
    // plus last-worn sync is the whole sequence, regardless of set size.
    expect(sql).toHaveBeenCalledTimes(3);
  });

  it("keeps an existing hero when committing without a new image", async () => {
    const sql = commitSql();
    sqlRequire.mockReturnValue(sql as never);

    await commitOutfitForDay({
      userId: "u1",
      wornOn: "2025-01-08",
      garmentIds: [gid],
      imageUrl: null,
    });

    expect(sqlTextOf(sql, 0)).toContain(
      "image_url = COALESCE(EXCLUDED.image_url, outfits.image_url)",
    );
  });

  it("throws when the commit returns no id", async () => {
    const sql = vi.fn().mockResolvedValueOnce([]);
    sqlRequire.mockReturnValue(sql as never);

    await expect(
      commitOutfitForDay({
        userId: "u1",
        wornOn: "2025-01-01",
        garmentIds: [gid],
      }),
    ).rejects.toThrow(/no id/i);
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
