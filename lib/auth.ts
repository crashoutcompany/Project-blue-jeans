import { Pool } from "@neondatabase/serverless";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";

import {
  AUTH_PREVIEW_ORIGIN,
  AUTH_PRODUCTION_URL,
  resolveAuthBaseUrl,
} from "@/lib/auth/config";

const googleClientId = process.env.AUTH_GOOGLE_ID?.trim();
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET?.trim();
const googleEnabled = Boolean(googleClientId && googleClientSecret);

export const providers: readonly "google"[] = googleEnabled ? ["google"] : [];

const socialProviders = googleEnabled
  ? {
      google: {
        clientId: googleClientId!,
        clientSecret: googleClientSecret!,
      },
    }
  : {};

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

export const auth = betterAuth({
  appName: "Project Blue Jeans",
  baseURL: resolveAuthBaseUrl(),
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [AUTH_PRODUCTION_URL, AUTH_PREVIEW_ORIGIN],
  database,
  socialProviders,
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 300,
    },
  },
  plugins: [nextCookies()],
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
