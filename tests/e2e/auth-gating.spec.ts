import { test, expect } from "@playwright/test";

test.describe("guest (no cookies)", () => {
  test("redirects /closet to sign-in", async ({ page }) => {
    await page.goto("/closet");
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });
});

test.describe("admin session", () => {
  test.use({ storageState: "tests/e2e/.auth/admin.json" });

  test("loads closet", async ({ page }) => {
    await page.goto("/closet");
    await expect(
      page.getByRole("button", { name: "Choose photos" }),
    ).toBeVisible();
  });

  test("loads Today on /", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Today" }).first(),
    ).toBeVisible();
    await expect(
      page
        .getByRole("button", { name: /Plan my week|Wear this|Change look/ })
        .or(page.getByRole("link", { name: "Add clothes" }))
        .first(),
    ).toBeVisible();
  });
});

test.describe("non-admin session", () => {
  test.use({ storageState: "tests/e2e/.auth/non-admin.json" });

  test("redirects /closet to not-admin", async ({ page }) => {
    await page.goto("/closet");
    await expect(page).toHaveURL(/\/auth\/not-admin/);
  });
});
