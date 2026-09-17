import { headers } from "next/headers";

import { auth as betterAuth } from "@/lib/auth";
import { createE2ePlaywrightAuth } from "@/lib/auth/e2e-playwright-auth";

const e2eAuth =
  process.env.E2E_PLAYWRIGHT === "1" ? createE2ePlaywrightAuth() : null;

export const auth = {
  async getSession(requestHeaders?: Headers) {
    if (e2eAuth) {
      return e2eAuth.getSession();
    }
    const data = await betterAuth.api.getSession({
      headers: requestHeaders ?? (await headers()),
    });
    return { data };
  },
};
