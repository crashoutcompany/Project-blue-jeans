import { test, expect } from "@playwright/test";

const SOME_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

/**
 * The proxy skips /api, so every mutating route must gate itself. Unit tests
 * mock the gate; this proves the built app wires it.
 */
const GATED_ROUTES = [
  { method: "POST", path: "/api/generate-lookbook", data: { narrative: "test" } },
  { method: "POST", path: "/api/closet/garments", data: { items: [] } },
  { method: "DELETE", path: "/api/closet/garments", data: { id: SOME_UUID } },
  {
    method: "POST",
    path: "/api/outfits/approve-generator",
    data: { wornOn: "2025-01-01", garmentIds: [SOME_UUID] },
  },
  { method: "GET", path: "/api/db/ping" },
] as const;

test.describe("API auth contract (no session)", () => {
  for (const route of GATED_ROUTES) {
    test(`${route.method} ${route.path} returns 401`, async ({ request }) => {
      const res = await request.fetch(route.path, {
        method: route.method,
        ...("data" in route ? { data: route.data } : {}),
      });
      expect(res.status()).toBe(401);
    });
  }
});
