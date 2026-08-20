import { test, expect } from "@playwright/test";

test.describe("signed-in session on landing", () => {
  test.use({ storageState: "tests/e2e/.auth/non-admin.json" });

  test("redirects home to not-admitted when signed in without membership", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/auth\/not-admitted/);
  });
});
