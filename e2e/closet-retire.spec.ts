import { neon } from "@neondatabase/serverless";
import {
  request,
  test,
  expect,
  type Page,
} from "@playwright/test";

import { TESTER_ID } from "../lib/auth/config";

/** Fixed id so a crashed run's leftover row is cleaned up by the next one. */
const GARMENT_ID = "8f3c2a1e-9b7d-4c5e-a6f0-88e2b1d4c7a9";
const GARMENT_NAME = "E2E retire blazer";

/** 1×1 PNG data URI: skips the image optimizer and needs no UploadThing. */
const PIXEL_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const databaseUrl = process.env.DATABASE_URL;

function db() {
  return neon(databaseUrl!);
}

async function removeSeededGarment() {
  await db()`DELETE FROM garments WHERE id = ${GARMENT_ID}::uuid`;
}

/** Delete through the app so the cached closet forgets the piece too. */
async function deleteThroughApp() {
  const api = await request.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    storageState: "e2e/.auth/admin.json",
  });
  try {
    await api.delete("/api/closet/garments", { data: { id: GARMENT_ID } });
  } finally {
    await api.dispose();
  }
}

async function openCloset(page: Page) {
  await page.goto("/closet");
  await expect(page.getByTestId("closet-content")).toBeVisible({
    timeout: 20_000,
  });
  return page.getByTestId("closet-content");
}

/**
 * Retire hides a piece (it moves to Closet → Retired) without deleting it, and
 * Unhide brings it back. Seeds one garment straight into the e2e database.
 */
test.describe("closet retire and unhide (admin)", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });
  test.describe.configure({ mode: "serial" });
  // Waiting out the stale closet cache can take a few reloads.
  test.setTimeout(90_000);
  test.skip(!databaseUrl, "needs DATABASE_URL to seed a garment");

  test.beforeAll(async () => {
    await removeSeededGarment();
    await db()`
      INSERT INTO garments (id, image_url, category, name, description, user_id)
      VALUES (
        ${GARMENT_ID}::uuid,
        ${PIXEL_DATA_URI},
        'outerwear',
        ${GARMENT_NAME},
        'Seeded by e2e/closet-retire.spec.ts',
        ${TESTER_ID}
      )
    `;
  });

  test.afterAll(async () => {
    await deleteThroughApp().catch(() => undefined);
    await removeSeededGarment();
  });

  test("retires a never-worn piece, lists it under Retired, and unhides it", async ({
    page,
  }) => {
    // The seed bypassed the app, so refresh the cached closet with a no-op
    // edit through the real route. It revalidates the closet tag with
    // stale-while-revalidate, so the next load can still serve the old list.
    const refresh = await page.request.patch("/api/closet/garments", {
      data: {
        id: GARMENT_ID,
        name: GARMENT_NAME,
        category: "outerwear",
        color: "",
        notes: "",
        description: "Seeded by e2e/closet-retire.spec.ts",
        regenerateNameWithAi: false,
        regenerateDescriptionWithAi: false,
      },
    });
    expect(refresh.ok()).toBe(true);

    let closet = page.getByTestId("closet-content");
    const card = closet.getByRole("button", {
      name: `View details for ${GARMENT_NAME}, never worn`,
    });
    await expect(async () => {
      closet = await openCloset(page);
      await expect(card).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });

    await card.click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByTestId("garment-detail-wear-count")).toHaveText(
      "Never worn",
    );
    await sheet.getByRole("button", { name: "Retire piece" }).click();
    await expect(sheet).toBeHidden();
    await expect(
      closet.getByRole("button", { name: /View details for E2E retire blazer/ }),
    ).toHaveCount(0);

    // Retiring persisted (not deleted): after a reload it is under Retired.
    closet = await openCloset(page);
    await expect(
      closet
        .getByRole("region", { name: "Closet pieces" })
        .getByRole("button", { name: /View details for E2E retire blazer/ }),
    ).toHaveCount(0);
    await closet.getByRole("tab", { name: "Retired" }).click();
    const retired = closet.getByRole("region", { name: "Retired pieces" });
    await expect(
      retired.getByRole("button", { name: /View details for E2E retire blazer/ }),
    ).toBeVisible();

    await retired
      .getByRole("button", { name: `Unhide ${GARMENT_NAME}` })
      .click();
    await expect(
      retired.getByRole("button", { name: /View details for E2E retire blazer/ }),
    ).toHaveCount(0);

    closet = await openCloset(page);
    await expect(
      closet.getByRole("button", { name: /View details for E2E retire blazer/ }),
    ).toBeVisible();
  });
});
