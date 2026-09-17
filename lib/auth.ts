import { Pool } from "@neondatabase/serverless";
import { headers } from "next/headers";

import {
  AUTH_PREVIEW_ORIGIN,
  AUTH_PRODUCTION_URL,
} from "@/lib/auth/config";
import {
  createAuth,
  getEnabledSocialProviders,
} from "@/lib/auth/create-auth";

export type { SocialProviderId } from "@/lib/auth/create-auth";

export const enabledSocialProviders = getEnabledSocialProviders();
export const providers = enabledSocialProviders;

const globalForAuth = globalThis as typeof globalThis & {
  blueJeansAuthPool?: Pool;
};

const database =
  globalForAuth.blueJeansAuthPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  });

if (process.env.NODE_ENV !== "production") {
  globalForAuth.blueJeansAuthPool = database;
}

export const auth = createAuth({
  appName: "Project Blue Jeans",
  database,
  productionUrl: AUTH_PRODUCTION_URL,
  previewOrigin: AUTH_PREVIEW_ORIGIN,
});

export async function getSession(requestHeaders?: Headers) {
  if (process.env.E2E_PLAYWRIGHT === "1") {
    const { createE2ePlaywrightAuth } = await import(
      "@/lib/auth/e2e-playwright-auth"
    );
    const { data } = await createE2ePlaywrightAuth().getSession();
    if (!data?.user) return null;
    return { user: data.user, session: { id: "e2e-session" } };
  }

  return auth.api.getSession({
    headers: requestHeaders ?? (await headers()),
  });
}

export type Session = typeof auth.$Infer.Session;
