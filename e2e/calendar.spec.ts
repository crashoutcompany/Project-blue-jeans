import { test, expect } from "@playwright/test";

/**
 * Months avoid January 2026, the prerendered shell's placeholder, so each
 * assertion can only pass once the requested month has streamed in.
 */
test.describe("calendar month navigation (admin)", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("steps across a year boundary and back", async ({ page }) => {
    await page.goto("/calendar?year=2025&month=1");
    const title = (text: string) =>
      page.getByText(text, { exact: true }).filter({ visible: true });
    await expect(title("January 2025")).toBeVisible({ timeout: 20_000 });

    await page
      .getByRole("link", { name: "Previous month" })
      .filter({ visible: true })
      .click();
    await expect(page).toHaveURL(/[?&]year=2024&month=12\b/);
    await expect(title("December 2024")).toBeVisible();

    await page
      .getByRole("link", { name: "Next month" })
      .filter({ visible: true })
      .click();
    await expect(page).toHaveURL(/[?&]year=2025&month=1\b/);
    await expect(title("January 2025")).toBeVisible();
  });
});
