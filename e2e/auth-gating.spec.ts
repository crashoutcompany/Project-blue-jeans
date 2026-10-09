import { test, expect } from "@playwright/test";

test.describe("guest (no cookies)", () => {
  for (const path of ["/closet", "/calendar", "/settings"]) {
    test(`redirects ${path} to sign-in`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/signin/);
    });
  }

  test("Get started on the landing page leads to sign-in", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Get started" }).first().click();
    await expect(page).toHaveURL(/\/signin/);
    await expect(
      page.getByRole("heading", { name: "Welcome back." }),
    ).toBeVisible();
  });
});

test.describe("admin session", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("lands on Today instead of the marketing page", async ({ page }) => {
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

  test("is sent away from sign-in", async ({ page }) => {
    await page.goto("/signin");
    await expect(page).not.toHaveURL(/\/signin/);
  });
});

test.describe("signed-in session without admission", () => {
  test.use({ storageState: "e2e/.auth/non-admin.json" });

  for (const path of ["/", "/closet"]) {
    test(`redirects ${path} to not-admitted`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/auth\/not-admitted/);
    });
  }
});
