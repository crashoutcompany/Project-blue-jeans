import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  requireSql: vi.fn(),
}));

vi.mock("@/lib/media/assets", () => ({
  getOwnedMediaAsset: vi.fn(),
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
import { getOwnedMediaAsset } from "@/lib/media/assets";
import {
  approveGeneratorPayloadSchema,
  assignOutfitToDay,
  commitOutfitForDay,
  executeApproveGeneratorOutfit,
  ownedHeroImagePath,
  unwearDay,
} from "@/lib/outfits/persist-generator-outfit";

const sqlRequire = vi.mocked(requireSql);
const ownedAsset = vi.mocked(getOwnedMediaAsset);

type Query = { text: string; values: unknown[] };

/**
 * Tagged-template mock with a Neon-style `transaction(queries)`. Statements
 * awaited directly and statements run inside a transaction are recorded
 * separately so tests can assert what was made atomic.
 */
function txSql(handler: (q: Query) => unknown = () => []) {
  const direct: Query[] = [];
  const transactions: Query[][] = [];
  const sql = Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query: Query = { text: strings.join(" "), values };
      return Object.assign(query, {
        then(
          resolve: (value: unknown) => unknown,
          reject: (reason: unknown) => unknown,
        ) {
          direct.push(query);
          return Promise.resolve(handler(query)).then(resolve, reject);
        },
      });
    },
    {
      transaction: vi.fn(async (queries: Query[]) => {
        transactions.push(queries);
        return Promise.all(queries.map((q) => handler(q)));
      }),
    },
  );
  return { sql, direct, transactions };
}

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
  const priorId = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";

  function commitHandler(prior: string | null = null, committedId = outfitId) {
    return (q: Query) => {
      if (q.text.includes("SELECT outfit_id::text AS prior_outfit_id")) {
        return prior ? [{ prior_outfit_id: prior }] : [];
      }
      if (q.text.includes("INSERT INTO outfits")) {
        return committedId ? [{ id: committedId }] : [];
      }
      return [];
    };
  }

  it("returns the committed outfit id", async () => {
    const { sql } = txSql(commitHandler());
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
    const { sql, transactions } = txSql(commitHandler());
    sqlRequire.mockReturnValue(sql as never);

    await commitOutfitForDay({
      userId: "u1",
      wornOn: "2025-01-01",
      garmentIds: [gid, gid2],
      imageUrl: "hero",
    });

    const commit = transactions[0]![0]!.text;
    expect(commit).toContain("INSERT INTO outfits");
    expect(commit).toContain("ON CONFLICT (user_id, garment_set_key)");
    expect(commit).toContain("INSERT INTO outfit_garments");
  });

  it("commits the outfit, its wear, and last-worn sync in one transaction", async () => {
    const { sql, direct, transactions } = txSql(commitHandler());
    sqlRequire.mockReturnValue(sql as never);

    await commitOutfitForDay({
      userId: "u1",
      wornOn: "2025-01-01",
      garmentIds: [gid],
    });

    // Only the prior-wear read runs outside the transaction.
    expect(direct).toHaveLength(1);
    expect(transactions).toHaveLength(1);
    const texts = transactions[0]!.map((q) => q.text);
    expect(texts).toHaveLength(3);
    expect(texts[1]).toContain("INSERT INTO outfit_wears");
    expect(texts[1]).toContain("ON CONFLICT (user_id, worn_on)");
    expect(texts[2]).toContain("UPDATE outfits o");
  });

  it("releases the day's previous outfit inside the same transaction", async () => {
    const { sql, transactions } = txSql(commitHandler(priorId));
    sqlRequire.mockReturnValue(sql as never);

    await commitOutfitForDay({
      userId: "u1",
      wornOn: "2025-01-01",
      garmentIds: [gid],
    });

    const tx = transactions[0]!;
    expect(tx).toHaveLength(5);
    expect(tx[3]!.text).toContain("UPDATE outfits o");
    expect(tx[3]!.values).toContain(priorId);
    expect(tx[4]!.text).toContain("DELETE FROM outfits o");
    expect(tx[4]!.values).toContain(priorId);
  });

  it("keeps an existing hero when committing without a new image", async () => {
    const { sql, transactions } = txSql(commitHandler());
    sqlRequire.mockReturnValue(sql as never);

    await commitOutfitForDay({
      userId: "u1",
      wornOn: "2025-01-08",
      garmentIds: [gid],
      imageUrl: null,
    });

    expect(transactions[0]![0]!.text).toContain(
      "image_url = COALESCE(EXCLUDED.image_url, outfits.image_url)",
    );
  });

  it("throws when the commit returns no id", async () => {
    const { sql } = txSql(commitHandler(null, ""));
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

describe("assignOutfitToDay", () => {
  const outfitId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const priorId = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";

  it("moves the day and releases the prior outfit atomically", async () => {
    const { sql, transactions } = txSql((q) => {
      if (q.text.includes("SELECT id FROM outfits")) return [{ id: outfitId }];
      if (q.text.includes("prior_outfit_id")) {
        return [{ prior_outfit_id: priorId }];
      }
      return [];
    });
    sqlRequire.mockReturnValue(sql as never);

    const res = await assignOutfitToDay({
      userId: "u1",
      outfitId,
      wornOn: "2026-08-10",
    });

    expect(res).toEqual({ ok: true, outfitId });
    const texts = transactions[0]!.map((q) => q.text);
    expect(texts).toHaveLength(4);
    expect(texts[0]).toContain("INSERT INTO outfit_wears");
    expect(texts[3]).toContain("DELETE FROM outfits o");
  });

  it("does not release an outfit re-worn on the same day", async () => {
    const { sql, transactions } = txSql((q) => {
      if (q.text.includes("SELECT id FROM outfits")) return [{ id: outfitId }];
      if (q.text.includes("prior_outfit_id")) {
        return [{ prior_outfit_id: outfitId }];
      }
      return [];
    });
    sqlRequire.mockReturnValue(sql as never);

    await assignOutfitToDay({ userId: "u1", outfitId, wornOn: "2026-08-10" });

    expect(transactions[0]).toHaveLength(2);
  });
});

describe("unwearDay", () => {
  const outfitId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

  it("deletes the wear and cleans up its outfit in one transaction", async () => {
    const { sql, transactions } = txSql((q) =>
      q.text.includes("prior_outfit_id")
        ? [{ prior_outfit_id: outfitId }]
        : [],
    );
    sqlRequire.mockReturnValue(sql as never);

    const res = await unwearDay("u1", "2026-08-10");

    expect(res).toEqual({ ok: true, outfitId });
    const texts = transactions[0]!.map((q) => q.text);
    expect(texts).toHaveLength(3);
    expect(texts[0]).toContain("DELETE FROM outfit_wears");
    expect(texts[2]).toContain("DELETE FROM outfits o");
  });

  it("is a no-op when nothing is worn that day", async () => {
    const { sql, transactions } = txSql();
    sqlRequire.mockReturnValue(sql as never);

    expect(await unwearDay("u1", "2026-08-10")).toEqual({
      ok: true,
      outfitId: "",
    });
    expect(transactions).toHaveLength(0);
  });
});

describe("ownedHeroImagePath", () => {
  const assetId = "0a8f3c1e-9b6d-4e2a-8c1f-3d5e7a9b1c2d";

  function asset(kind: "outfit_hero" | "closet_image") {
    return {
      id: assetId,
      userId: "u1",
      connectionId: null,
      kind,
      providerFileKey: "key",
    };
  }

  it("keeps the Wearer's own generated hero", async () => {
    ownedAsset.mockResolvedValueOnce(asset("outfit_hero"));
    await expect(
      ownedHeroImagePath("u1", `/api/media/${assetId}`),
    ).resolves.toBe(`/api/media/${assetId}`);
    expect(ownedAsset).toHaveBeenLastCalledWith("u1", assetId);
  });

  it("drops a media asset that is not an outfit hero", async () => {
    ownedAsset.mockResolvedValueOnce(asset("closet_image"));
    await expect(
      ownedHeroImagePath("u1", `/api/media/${assetId}`),
    ).resolves.toBeNull();
  });

  it("drops another account's or unknown asset", async () => {
    ownedAsset.mockResolvedValueOnce(null);
    await expect(
      ownedHeroImagePath("u1", `/api/media/${assetId}`),
    ).resolves.toBeNull();
  });

  it("drops arbitrary URLs without a lookup", async () => {
    ownedAsset.mockClear();
    for (const url of [
      "data:image/png;base64,AAAA",
      "https://tracker.example.com/pixel.png",
      null,
    ]) {
      await expect(ownedHeroImagePath("u1", url)).resolves.toBeNull();
    }
    expect(ownedAsset).not.toHaveBeenCalled();
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
