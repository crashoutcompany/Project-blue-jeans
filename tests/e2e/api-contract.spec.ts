import { test, expect } from "@playwright/test";

test.describe("API auth contract (no session)", () => {
  test("POST /api/generate-lookbook returns 401", async ({ request }) => {
    const res = await request.post("/api/generate-lookbook", {
      data: { narrative: "test" },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/closet/garments returns 401", async ({ request }) => {
    const res = await request.post("/api/closet/garments", {
      data: { items: [] },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/outfits/approve-generator returns 401", async ({
    request,
  }) => {
    const res = await request.post("/api/outfits/approve-generator", {
      data: {
        wornOn: "2025-01-01",
        garmentIds: ["f47ac10b-58cc-4372-a567-0e02b2c3d479"],
      },
    });
    expect(res.status()).toBe(401);
  });

  test("GET /api/db/ping returns 401", async ({ request }) => {
    const res = await request.get("/api/db/ping");
    expect(res.status()).toBe(401);
  });
});
