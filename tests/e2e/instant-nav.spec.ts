import { expect, test, type Locator, type Page } from "@playwright/test";
import { instant } from "@next/playwright";

/**
 * Locked instant() guards for app navigations.
 * Build with EXPOSE_TESTING_API=1 before `npm run start` (see instant-nav.rig.md).
 *
 * Product nav is Today · Closet · Calendar. Generator is a sheet on Today;
 * /dashboard redirects to /closet.
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

/** Soft nav can leave a hidden prior shell in the tree — assert the visible one. */
function visibleTestId(page: Page, testId: string): Locator {
  return page.getByTestId(testId).filter({ visible: true }).first();
}

test.describe("instant soft nav (admin)", () => {
  test.use({ storageState: "tests/e2e/.auth/admin.json" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/closet");
    await expect(visibleTestId(page, "closet-shell-marker")).toBeVisible({
      timeout: 20_000,
    });
  });

  test("closet shell commits under instant()", async ({ page }) => {
    await page.goto("/calendar");
    await expect(visibleTestId(page, "calendar-shell-marker")).toBeVisible({
      timeout: 20_000,
    });
    const trigger = visibleTestId(page, "nav-closet-link");
    await expect(trigger).toBeVisible({ timeout: 20_000 });

    await instant(page, async () => {
      await trigger.click();
      await expect(visibleTestId(page, "closet-shell-marker")).toBeVisible();
      await expect(page.getByTestId("closet-content")).toHaveCount(0);
    });
  });

  test("calendar shell commits under instant()", async ({ page }) => {
    const trigger = visibleTestId(page, "nav-calendar-link");
    await expect(trigger).toBeVisible({ timeout: 20_000 });

    await instant(page, async () => {
      await trigger.click();
      await expect(visibleTestId(page, "calendar-shell-marker")).toBeVisible();
      await expect(page.getByTestId("calendar-content")).toHaveCount(0);
    });
  });
});

test.describe("instant initial load", () => {
  test("landing shell is served", async ({ page }) => {
    const url = `${BASE}/`;
    await instant(
      page,
      async () => {
        await page.goto(url);
        await expect(visibleTestId(page, "landing-shell-marker")).toBeVisible();
      },
      { baseURL: new URL(url).origin },
    );
  });

  test.describe("admin session", () => {
    test.use({ storageState: "tests/e2e/.auth/admin.json" });

    test("closet shell is served", async ({ page }) => {
      const url = `${BASE}/closet`;
      await instant(
        page,
        async () => {
          await page.goto(url);
          await expect(visibleTestId(page, "closet-shell-marker")).toBeVisible();
          await expect(page.getByTestId("closet-content")).toHaveCount(0);
        },
        { baseURL: new URL(url).origin },
      );
    });

    test("calendar shell is served", async ({ page }) => {
      const url = `${BASE}/calendar`;
      await instant(
        page,
        async () => {
          await page.goto(url);
          await expect(
            visibleTestId(page, "calendar-shell-marker"),
          ).toBeVisible();
          await expect(page.getByTestId("calendar-content")).toHaveCount(0);
        },
        { baseURL: new URL(url).origin },
      );
    });
  });

  test.describe("non-admin session", () => {
    test.use({ storageState: "tests/e2e/.auth/non-admin.json" });

    test("not-admin shell is served", async ({ page }) => {
      const url = `${BASE}/auth/not-admin`;
      await instant(
        page,
        async () => {
          await page.goto(url);
          await expect(
            visibleTestId(page, "not-admin-shell-marker"),
          ).toBeVisible();
        },
        { baseURL: new URL(url).origin },
      );
    });
  });

  test("auth shell is served", async ({ page }) => {
    const url = `${BASE}/auth/sign-in`;
    await instant(
      page,
      async () => {
        await page.goto(url);
        await expect(visibleTestId(page, "auth-shell-marker")).toBeVisible();
      },
      { baseURL: new URL(url).origin },
    );
  });
});
