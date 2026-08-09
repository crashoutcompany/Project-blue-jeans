import type { Page } from "@playwright/test";

/**
 * Stub JSON for client-side `fetch` calls (UploadThing, etc.) in E2E when needed.
 */
export async function routeJson(
  page: Page,
  urlPattern: string | RegExp,
  body: unknown,
  status = 200,
) {
  await page.route(urlPattern, async (route) => {
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}
