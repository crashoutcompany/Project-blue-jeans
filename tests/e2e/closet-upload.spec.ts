import { test, expect } from "@playwright/test";

/**
 * Smoke: closet page renders for admin (DB may be empty in CI).
 */
test.describe("closet (admin)", () => {
  test.use({ storageState: "tests/e2e/.auth/admin.json" });

  test("shows closet heading", async ({ page }) => {
    await page.goto("/closet");
    await expect(
      page.getByRole("heading", { name: /your closet/i }),
    ).toBeVisible();
  });
});
