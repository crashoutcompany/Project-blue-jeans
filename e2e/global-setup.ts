import { mkdir } from "node:fs/promises";
import path from "node:path";

import { request, type FullConfig } from "@playwright/test";

const AUTH_DIR = path.join(process.cwd(), "e2e/.auth");

export default async function globalSetup(config: FullConfig) {
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
