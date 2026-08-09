import { test, expect } from "@playwright/test";

/**
 * Smoke: closet renders for admin (DB may be empty in CI).
 */
test.describe("closet (admin)", () => {
  test.use({ storageState: "tests/e2e/.auth/admin.json" });

  test("shows closet on /closet", async ({ page }) => {
    await page.goto("/closet");
    await expect(
      page.getByRole("button", { name: "Add clothes" }),
    ).toBeVisible();
  });

  test("redirects /dashboard to closet", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/closet/);
    await expect(
      page.getByRole("button", { name: "Add clothes" }),
    ).toBeVisible();
  });
});
