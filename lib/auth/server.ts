import { createNeonAuth } from "@neondatabase/auth/next/server";

import { createE2ePlaywrightAuth } from "@/lib/auth/e2e-playwright-auth";

/** Neon Console → Branch → Auth → Configuration. Also set NEON_AUTH_COOKIE_SECRET (32+ chars). */
export const auth =
  process.env.E2E_PLAYWRIGHT === "1"
    ? createE2ePlaywrightAuth()
    : createNeonAuth({
        baseUrl: process.env.NEON_AUTH_BASE_URL!,
        cookies: {
          secret: process.env.NEON_AUTH_COOKIE_SECRET!,
        },
      });
