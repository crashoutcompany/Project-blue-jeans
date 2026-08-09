import { test, expect } from "@playwright/test";

test.describe("calendar (admin)", () => {
  test.use({ storageState: "tests/e2e/.auth/admin.json" });

  test("shows calendar heading", async ({ page }) => {
    await page.goto("/calendar");
    await expect(
      page.getByRole("heading", { name: /outfit calendar/i }),
    ).toBeVisible();
  });
});
