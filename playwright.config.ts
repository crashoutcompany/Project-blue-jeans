import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start",
    url: baseURL,
    // Never reuse `next dev` — it lacks E2E_PLAYWRIGHT auth stub and 127.0.0.1→localhost redirects break Playwright.
    // Opt in with PW_REUSE_SERVER=1 only for an already-running `next start` with E2E_PLAYWRIGHT=1.
    reuseExistingServer: process.env.PW_REUSE_SERVER === "1",
    timeout: 120_000,
    env: {
      ...process.env,
      E2E_PLAYWRIGHT: "1",
      PORT: "3000",
      HOSTNAME: "127.0.0.1",
      NEON_AUTH_BASE_URL:
        process.env.NEON_AUTH_BASE_URL ?? "https://example.invalid",
      NEON_AUTH_COOKIE_SECRET:
        process.env.NEON_AUTH_COOKIE_SECRET ??
        "01234567890123456789012345678901",
    },
  },
});

