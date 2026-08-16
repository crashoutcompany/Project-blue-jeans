import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Smoke: each main app route renders (or redirects) without crashing.
 * Auth stub via storageState / no cookies — does not mutate real session cookies.
 */

/** PPR / soft-nav can leave a duplicate shell marker in the tree. */
function visibleTestId(page: Page, testId: string): Locator {
  return page.getByTestId(testId).filter({ visible: true }).first();
}

test.describe("guest page smoke", () => {
  test("landing renders brand and CTA", async ({ page }) => {
    await page.goto("/");
    await expect(visibleTestId(page, "landing-shell-marker")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Get started" }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Project Blue Jeans", { exact: true }).first(),
    ).toBeVisible();
  });

  test("sign-in auth shell renders", async ({ page }) => {
    await page.goto("/auth/sign-in");
    await expect(visibleTestId(page, "auth-shell-marker")).toBeVisible();
  });
});

test.describe("admin page smoke", () => {
  test.use({ storageState: "tests/e2e/.auth/admin.json" });

  test("home day look shell renders", async ({ page }) => {
    await page.goto("/");
    await expect(visibleTestId(page, "today-shell-marker")).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole("link", { name: "Today" }).first(),
    ).toBeVisible();
  });

  test("closet renders", async ({ page }) => {
    await page.goto("/closet");
    await expect(visibleTestId(page, "closet-shell-marker")).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole("button", { name: "Choose photos" }),
    ).toBeVisible();
  });

  test("calendar renders", async ({ page }) => {
    await page.goto("/calendar");
    await expect(visibleTestId(page, "calendar-shell-marker")).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole("link", { name: /previous month/i }),
    ).toBeVisible();
  });

  test("settings renders", async ({ page }) => {
    await page.goto("/settings");
    await expect(
      page.getByRole("heading", { name: "Settings", level: 1 }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: "Wearer photo", level: 2 }),
    ).toBeVisible();
  });

  test("privacy renders", async ({ page }) => {
    await page.goto("/privacy");
    await expect(visibleTestId(page, "privacy-shell-marker")).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole("heading", { name: "Privacy", level: 1 }),
    ).toBeVisible();
  });

  test("terms renders", async ({ page }) => {
    await page.goto("/terms");
    await expect(visibleTestId(page, "terms-shell-marker")).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole("heading", { name: "Terms", level: 1 }),
    ).toBeVisible();
  });

  test("generator deep-links to change-look on home", async ({ page }) => {
    await page.goto("/generator");
    await expect(page).toHaveURL(/\/\?change-look=1/);
    await expect(
      page
        .locator("main")
        .getByTestId("today-shell-marker")
        .filter({ visible: true })
        .first(),
    ).toBeVisible({
      timeout: 20_000,
    });
  });

  test("dashboard redirects to closet", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/closet/);
    await expect(visibleTestId(page, "closet-shell-marker")).toBeVisible({
      timeout: 20_000,
    });
  });
});
