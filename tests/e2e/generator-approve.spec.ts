import { test, expect } from "@playwright/test";

test.describe("generator (admin)", () => {
  test.use({ storageState: "tests/e2e/.auth/admin.json" });

  test("opens Change look sheet from /generator", async ({ page }) => {
    await page.goto("/generator");
    await expect(page).toHaveURL(/[?&]change-look=1/);
    await expect(page.getByText("Change look").first()).toBeVisible();
  });
});
