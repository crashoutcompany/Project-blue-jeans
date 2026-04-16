import { test, expect } from "@playwright/test";

test.describe("non-admin on landing", () => {
  test.use({ storageState: "tests/e2e/.auth/non-admin.json" });

  test("redirects home to not-admin when signed in as non-admin", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/auth\/not-admin/);
  });
});
