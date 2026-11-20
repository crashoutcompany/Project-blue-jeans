import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { request, type FullConfig } from "@playwright/test";

const AUTH_DIR = path.join(process.cwd(), "e2e/.auth");

/**
 * CI gives the e2e job its own throwaway Neon branch, copied from a parent that
 * may predate this PR's schema changes, so bring it up to date first. Not run
 * locally, where DATABASE_URL may be a database you want left alone.
 */
function migrateCiDatabase() {
  if (!process.env.CI || !process.env.DATABASE_URL) return;
  execFileSync("pnpm", ["db:migrate"], {
    stdio: "inherit",
    env: {
      ...process.env,
      // Prefer the direct (unpooled) URL the shared CI exposes as DIRECT_URL.
      DATABASE_URL_UNPOOLED:
        process.env.DIRECT_URL ?? process.env.DATABASE_URL_UNPOOLED,
    },
  });
}

export default async function globalSetup(config: FullConfig) {
  migrateCiDatabase();

  const secret = process.env.TEST_AUTH_SECRET;
  if (!secret) throw new Error("TEST_AUTH_SECRET is required for E2E");

  const baseURL =
    config.projects[0]?.use.baseURL ??
    process.env.PLAYWRIGHT_BASE_URL ??
    "http://127.0.0.1:3000";
  await mkdir(AUTH_DIR, { recursive: true });

  for (const account of [
    { file: "admin.json", selector: "admitted" },
    { file: "non-admin.json", selector: "non-admitted" },
  ]) {
    const api = await request.newContext({ baseURL });
    const response = await api.post("/api/test-auth/login", {
      headers: {
        "x-test-auth-secret": secret,
        "x-test-auth-user": account.selector,
      },
    });
    if (!response.ok()) {
      throw new Error(
        `Test login for ${account.selector} failed with ${response.status()}`,
      );
    }
    await api.storageState({ path: path.join(AUTH_DIR, account.file) });
    await api.dispose();
  }
}
