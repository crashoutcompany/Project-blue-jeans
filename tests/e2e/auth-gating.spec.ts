import { test, expect } from "@playwright/test";

test.describe("guest (no cookies)", () => {
  test("redirects /dashboard to sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });
});

test.describe("admin session", () => {
  test.use({ storageState: "tests/e2e/.auth/admin.json" });

  test("loads closet on dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("button", { name: "Add clothes" }),
    ).toBeVisible();
  });
});

test.describe("non-admin session", () => {
  test.use({ storageState: "tests/e2e/.auth/non-admin.json" });

  test("redirects /dashboard to not-admin", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/not-admin/);
  });
});
