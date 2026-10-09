import { test, expect } from "@playwright/test";

import { routeJson } from "./fixtures";

/** 1×1 PNG — small enough that on-device compression passes it through. */
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function photo(name: string) {
  return { name, mimeType: "image/png", buffer: PIXEL_PNG };
}

/**
 * Add-garment flow up to (not including) "Add to closet", which needs
 * UploadThing. Photos stay on the device as editable draft cards.
 */
test.describe("closet add-garment drafts (admin)", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test.beforeEach(async ({ page }) => {
    // Keep Gemini out of the loop: every photo is suggested as Bottoms.
    await routeJson(page, "**/api/closet/suggest-category", {
      ok: true,
      category: "bottoms",
    });
    await page.goto("/closet");
    // The Suspense fallback is also a ClosetView, so wait for the streamed one.
    await expect(
      page
        .getByTestId("closet-content")
        .getByRole("button", { name: "Choose photos" }),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("queues a photo as an editable draft with a suggested category", async ({
    page,
  }) => {
    await page
      .getByTestId("closet-content")
      .getByLabel("Choose clothing photos")
      .setInputFiles(photo("black-jeans.png"));

    const drafts = page.getByRole("region", { name: "Ready to save" });
    await expect(drafts).toBeVisible();
    const name = drafts.getByRole("textbox", { name: "Name" });
    await expect(name).toHaveValue("black-jeans");
    await expect(
      drafts.getByRole("button", { name: "Bottoms" }),
    ).toHaveAttribute("aria-pressed", "true");

    await name.fill("Raw denim");
    await drafts.getByRole("button", { name: "Outerwear" }).click();

    await expect(name).toHaveValue("Raw denim");
    await expect(
      drafts.getByRole("button", { name: "Outerwear" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: "Add to closet" }),
    ).toBeEnabled();
  });

  test("removes one draft and clears the rest of the queue", async ({
    page,
  }) => {
    await page
      .getByTestId("closet-content")
      .getByLabel("Choose clothing photos")
      .setInputFiles([photo("tee.png"), photo("boots.png")]);

    const drafts = page.getByRole("region", { name: "Ready to save" });
    const removeButtons = drafts.getByRole("button", {
      name: "Remove from queue",
    });
    await expect(removeButtons).toHaveCount(2);

    await removeButtons.first().click();
    await expect(removeButtons).toHaveCount(1);

    await page.getByRole("button", { name: "Clear queue" }).click();
    await expect(drafts).toHaveCount(0);
    await expect(page.getByText("New archive piece")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add to closet" }),
    ).toHaveCount(0);
  });
});
