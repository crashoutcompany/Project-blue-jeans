import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  getSql: vi.fn(),
}));

vi.mock("@/lib/server/safe-client-error", () => ({
  logServerError: vi.fn(),
}));

import { getSql } from "@/lib/db";
import { garmentSetKey } from "@/lib/outfits/garment-set-key";
import {
  existingHeroForGarments,
  findExistingOutfitHeroUrls,
} from "@/lib/outfits/existing-outfit-heroes";

const getSqlMock = vi.mocked(getSql);

const GID_A = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const GID_B = "b47ac10b-58cc-4372-a567-0e02b2c3d479";

describe("existingHeroForGarments", () => {
  it("returns the stored hero for a matching garment set", () => {
    const key = garmentSetKey([GID_B, GID_A]);
    const heroes = new Map([[key, "https://cdn.example.com/hero.jpg"]]);
    expect(existingHeroForGarments(heroes, [GID_A, GID_B])).toBe(
      "https://cdn.example.com/hero.jpg",
    );
  });

  it("returns undefined when the set is missing or empty", () => {
    expect(existingHeroForGarments(new Map(), [GID_A])).toBeUndefined();
    expect(existingHeroForGarments(new Map(), [])).toBeUndefined();
  });
});

describe("findExistingOutfitHeroUrls", () => {
  beforeEach(() => {
    getSqlMock.mockReset();
  });

  it("returns an empty map when the database is not configured", async () => {
    getSqlMock.mockReturnValue(undefined);
    const heroes = await findExistingOutfitHeroUrls("u1", [[GID_A]]);
    expect(heroes.size).toBe(0);
  });

  it("does not query when there are no garment-set keys", async () => {
    const sql = vi.fn();
    getSqlMock.mockReturnValue(sql as never);
    const heroes = await findExistingOutfitHeroUrls("u1", [[], []]);
    expect(sql).not.toHaveBeenCalled();
    expect(heroes.size).toBe(0);
  });

  it("maps stored heroes by garment_set_key", async () => {
    const key = garmentSetKey([GID_A, GID_B]);
    const sql = vi.fn().mockResolvedValue([
      { garment_set_key: key, image_url: "https://cdn.example.com/saved.jpg" },
    ]);
    getSqlMock.mockReturnValue(sql as never);

    const heroes = await findExistingOutfitHeroUrls("u1", [
      [GID_B, GID_A],
      [GID_A],
    ]);

    expect(heroes.get(key)).toBe("https://cdn.example.com/saved.jpg");
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("returns an empty map when the query throws", async () => {
    const sql = vi.fn().mockRejectedValue(new Error("db down"));
    getSqlMock.mockReturnValue(sql as never);
    const heroes = await findExistingOutfitHeroUrls("u1", [[GID_A]]);
    expect(heroes.size).toBe(0);
  });
});
