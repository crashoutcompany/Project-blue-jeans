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

test.describe("sign-out", () => {
  // A fresh session of its own: signing out revokes the session server-side,
  // so it must not share the admin.json cookie the other specs rely on.
  // Goes through POST /auth/sign-out rather than the menu: the auth client's
  // origin check rejects http://127.0.0.1 in CI (base URL is the production
  // URL), which would leave the session alive.
  test("revokes the session so protected pages redirect to sign-in", async ({
    page,
  }) => {
    const secret = process.env.TEST_AUTH_SECRET ?? "test-auth-secret";
    const login = await page.request.post("/api/test-auth/login", {
      headers: {
        "x-test-auth-secret": secret,
        "x-test-auth-user": "admitted",
      },
    });
    expect(login.ok()).toBe(true);

    await page.goto("/closet");
    await expect(page).toHaveURL(/\/closet/);

    const signOut = await page.request.post("/auth/sign-out", {
      maxRedirects: 0,
    });
    expect(signOut.status()).toBe(303);
    expect(signOut.headers()["location"]).toContain("/signin");

    await page.goto("/closet");
    await expect(page).toHaveURL(/\/signin/);
  });
});
