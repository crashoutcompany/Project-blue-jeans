import { test, expect } from "@playwright/test";

/**
 * Smoke: closet (dashboard) renders for admin (DB may be empty in CI).
 */
test.describe("closet (admin)", () => {
  test.use({ storageState: "tests/e2e/.auth/admin.json" });

  test("shows closet on dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByLabel("Add clothes")).toBeVisible();
  });

  test("redirects /closet to dashboard", async ({ page }) => {
    await page.goto("/closet");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByLabel("Add clothes")).toBeVisible();
  });
});
