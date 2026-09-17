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
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      PORT: "3000",
      HOSTNAME: "127.0.0.1",
      EXPOSE_TESTING_API: process.env.EXPOSE_TESTING_API ?? "1",
      BETTER_AUTH_SECRET:
        process.env.BETTER_AUTH_SECRET ??
        "test-better-auth-secret-at-least-32-characters",
      TEST_AUTH_SECRET: process.env.TEST_AUTH_SECRET ?? "test-auth-secret",
    },
  },
});
