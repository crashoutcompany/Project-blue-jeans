import { test, expect, type Page } from "@playwright/test";

/**
 * Regression guard for /calendar hydration. The original bug logged
 * "Couldn't find all resumable slots by key/index during replaying" on the
 * server (digest in the Vercel runtime logs), where Playwright can't see it;
 * its unit-level guard is the clock-read test in outfit-calendar.test.tsx.
 * This spec covers the browser side: no hydration errors, and the "today"
 * highlight comes from the server's product-timezone date whatever timezone
 * the browser is in. Production builds minify most React messages, so match
 * the minified hydration error codes (418/419/422/423/425) too.
 */
const HYDRATION_ERROR =
  /hydrat|resumable slots|did(?:n't| not) match|react\.dev\/errors\/(?:418|419|422|423|425)|Minified React error #(?:418|419|422|423|425)/i;

function collectHydrationErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error" && msg.type() !== "warning") return;
    if (HYDRATION_ERROR.test(msg.text())) errors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    if (HYDRATION_ERROR.test(err.message)) errors.push(err.message);
  });
  return errors;
}

// Months other than the placeholder's (January 2026) so the assertions can
// only pass once the real content has replaced the Suspense fallback.
const CASES = [
  { name: "default month", path: "/calendar" },
  { name: "explicit month", path: "/calendar?year=2025&month=3" },
];

function productToday() {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  })
    .format(new Date())
    .split("-")
    .map(Number);
  return { y, m, d };
}

// The product clock is America/New_York; browsers elsewhere must not change
// what hydrates. Kiritimati (UTC+14) and Honolulu (UTC-10) straddle "today".
const TIME_ZONES = ["America/New_York", "Pacific/Kiritimati", "Pacific/Honolulu"];

test.describe("calendar hydration (admin)", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  for (const timezoneId of TIME_ZONES) {
    test.describe(`browser timezone ${timezoneId}`, () => {
      test.use({ timezoneId });

      for (const { name, path } of CASES) {
        test(`${name} hydrates without errors`, async ({ page }) => {
          const errors = collectHydrationErrors(page);

          await page.goto(path);
          await expect(page.getByTestId("calendar-content")).toBeVisible({
            timeout: 20_000,
          });
          // Hydration (and any client-render fallback) runs after content
          // streams in; wait for the app to settle before asserting.
          await page.waitForLoadState("networkidle");

          expect(errors).toEqual([]);
        });
      }

      test("highlights product-timezone today", async ({ page }) => {
        const { y, m, d } = productToday();
        await page.goto(`/calendar?year=${y}&month=${m}`);
        await expect(page.getByTestId("calendar-content")).toBeVisible({
          timeout: 20_000,
        });
        const today = page.locator('[aria-current="date"]');
        await expect(today).toHaveCount(1);
        await expect(today).toContainText(new RegExp(`^${d}\\b`));
      });
    });
  }
});
