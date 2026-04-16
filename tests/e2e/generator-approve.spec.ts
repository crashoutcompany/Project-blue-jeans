import { test, expect } from "@playwright/test";

test.describe("generator (admin)", () => {
  test.use({ storageState: "tests/e2e/.auth/admin.json" });

  test("shows outfit dialogue heading", async ({ page }) => {
    await page.goto("/generator");
    await expect(
      page.getByRole("heading", { name: /outfit dialogue/i }),
    ).toBeVisible();
  });
});
