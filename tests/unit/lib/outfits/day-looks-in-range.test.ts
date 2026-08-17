import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  getSql: vi.fn(),
}));

import { getSql } from "@/lib/db";
import {
  firstPerDay,
  loadFitsInRange,
  loadOutfitsInRange,
} from "@/lib/outfits/day-looks-in-range";

const getSqlMock = vi.mocked(getSql);
const USER_ID = "user-1";
const OUTFIT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const FIT_ID = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const GARMENT_ID = "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";

function sqlText(strings: TemplateStringsArray) {
  return strings.join(" ");
}

describe("firstPerDay", () => {
  it("keeps the first row for each wornOn", () => {
    const map = firstPerDay([
      { wornOn: "2026-08-10", id: "a" },
      { wornOn: "2026-08-10", id: "b" },
      { wornOn: "2026-08-11", id: "c" },
    ]);
    expect(map.get("2026-08-10")?.id).toBe("a");
    expect(map.get("2026-08-11")?.id).toBe("c");
  });
});

describe("loadOutfitsInRange / loadFitsInRange", () => {
  beforeEach(() => {
    getSqlMock.mockReset();
  });

  it("parses Outfit rows and rejects invalid shapes", async () => {
    getSqlMock.mockReturnValue(
      vi.fn((strings: TemplateStringsArray) => {
        const text = sqlText(strings);
        if (text.includes("outfit_wears")) {
          return Promise.resolve([
            {
              worn_on: "2026-08-10",
              id: OUTFIT_ID,
              name: "Navy",
              image_url: null,
              occasion: "casual",
              garment_ids: [GARMENT_ID],
            },
          ]);
        }
        return Promise.resolve([]);
      }) as never,
    );

    const rows = await loadOutfitsInRange(USER_ID, "2026-08-09", "2026-08-15");
    expect(rows).toEqual([
      {
        wornOn: "2026-08-10",
        id: OUTFIT_ID,
        name: "Navy",
        imageUrl: null,
        occasion: "casual",
        garmentIds: [GARMENT_ID],
      },
    ]);
  });

  it("returns empty when Fit rows fail validation", async () => {
    getSqlMock.mockReturnValue(
      vi.fn(() =>
        Promise.resolve([
          {
            worn_on: "not-a-date",
            plan_look_id: FIT_ID,
            title: "Bad",
            hero_image_url: null,
            garment_ids: [],
          },
        ]),
      ) as never,
    );

    const rows = await loadFitsInRange(USER_ID, "2026-08-09", "2026-08-15");
    expect(rows).toEqual([]);
  });
});
