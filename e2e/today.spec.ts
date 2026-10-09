import { test, expect } from "@playwright/test";

import { routeJson } from "./fixtures";

/** Stand-in for Gemini so the flow does not depend on a provider key. */
const GENERATED = {
  ok: true,
  curatorNote: "Two easy options for today.",
  looks: [
    {
      id: "look-a",
      title: "Gallery navy",
      description: "Navy knit over relaxed denim.",
      tags: ["day"],
      featured: true,
      garmentIds: [],
    },
    {
      id: "look-b",
      title: "Travel khaki",
      description: "Khaki layers that pack flat.",
      tags: ["travel"],
      garmentIds: [],
    },
  ],
};

test.describe("Change look sheet (admin)", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("generates looks and guards them before closing", async ({ page }) => {
    await routeJson(page, "**/api/generate-lookbook", GENERATED);

    // /generator is the deep link into the sheet on Today.
    await page.goto("/generator");
    await expect(page).toHaveURL(/\/\?change-look=1/);
    const sheet = page.getByRole("dialog", { name: "Change look" });
    await expect(sheet).toBeVisible({ timeout: 20_000 });

    const request = page.waitForRequest("**/api/generate-lookbook");
    await sheet.getByRole("textbox", { name: "Outfit request" }).fill(
      "Gallery opening after work",
    );
    await sheet.getByRole("button", { name: "Send" }).click();
    expect((await request).postDataJSON()).toMatchObject({
      narrative: expect.stringMatching(/gallery opening after work/i),
    });

    await expect(
      sheet.getByRole("heading", { name: "Gallery navy" }),
    ).toBeVisible();
    await expect(sheet.getByText(/Look 1 of 2: Gallery navy/)).toBeAttached();

    // Unapproved looks are not dropped on the first close.
    await sheet.getByRole("button", { name: "Close" }).click();
    const discard = page.getByRole("dialog", { name: "Discard looks?" });
    await expect(discard).toBeVisible();
    await discard.getByRole("button", { name: "Keep editing" }).click();
    await expect(discard).toBeHidden();
    await expect(
      sheet.getByRole("heading", { name: "Gallery navy" }),
    ).toBeVisible();

    await sheet.getByRole("button", { name: "Close" }).click();
    await page
      .getByRole("dialog", { name: "Discard looks?" })
      .getByRole("button", { name: "Discard" })
      .click();
    await expect(sheet).toBeHidden();
    await expect(page).not.toHaveURL(/change-look/);
  });

  test("shows a generation failure inside the sheet", async ({ page }) => {
    await routeJson(
      page,
      "**/api/generate-lookbook",
      { ok: false, message: "Add a Google AI Studio key in Settings." },
      422,
    );

    await page.goto("/?change-look=1");
    const sheet = page.getByRole("dialog", { name: "Change look" });
    await expect(sheet).toBeVisible({ timeout: 20_000 });
    await sheet.getByRole("textbox", { name: "Outfit request" }).fill("Brunch");
    await sheet.getByRole("button", { name: "Send" }).click();

    await expect(
      sheet.getByText("Add a Google AI Studio key in Settings."),
    ).toBeVisible();
    // Nothing generated, so closing needs no confirmation.
    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(sheet).toBeHidden();
  });
});
