import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  getSql: vi.fn(),
}));

import { getSql } from "@/lib/db";
import { loadCalendarMonthData } from "@/lib/outfits/calendar-data";

const getSqlMock = vi.mocked(getSql);
const USER_ID = "user-1";
const LOOK_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const GARMENT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

function sqlText(strings: TemplateStringsArray) {
  return strings.join(" ");
}

function mockSql(handler: (text: string) => unknown) {
  return vi.fn((strings: TemplateStringsArray) =>
    Promise.resolve(handler(sqlText(strings))),
  );
}

describe("loadCalendarMonthData", () => {
  beforeEach(() => {
    getSqlMock.mockReset();
  });

  it("attaches garment thumbs when a weekly look has no hero", async () => {
    getSqlMock.mockReturnValue(
      mockSql((text) => {
        if (text.includes("outfit_wears")) return [];
        if (text.includes("weekly_plan_looks")) {
          return [
            {
              plan_look_id: LOOK_ID,
              worn_on: "2026-08-16",
              title: "Monday Focus",
              hero_image_url: null,
              garment_ids: [GARMENT_ID],
            },
          ];
        }
        if (text.includes("FROM garments")) {
          expect(text).toMatch(/::uuid\[\]/);
          return [
            {
              id: GARMENT_ID,
              image_url: "https://cdn.example.com/g1.jpg",
              media_asset_id: null,
            },
          ];
        }
        return [];
      }) as never,
    );

    const { weeklyDrafts, saved } = await loadCalendarMonthData(
      USER_ID,
      2026,
      8,
    );

    expect(saved).toEqual([]);
    expect(weeklyDrafts).toEqual([
      {
        planLookId: LOOK_ID,
        wornOn: "2026-08-16",
        title: "Monday Focus",
        heroImageUrl: null,
        garmentIds: [GARMENT_ID],
        garmentThumbs: [
          { id: GARMENT_ID, imageUrl: "https://cdn.example.com/g1.jpg" },
        ],
      },
    ]);
  });
});
