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
import { isEmailOtpEnabled } from "@/lib/auth/email-otp";
import { otpOwnerGuardPlugin } from "@/lib/auth/membership";

export type { SocialProviderId } from "@/lib/auth/create-auth";

export const enabledSocialProviders = getEnabledSocialProviders();
export const providers = enabledSocialProviders;
/** Allowlisted email OTP sign-in (bots). The UI hides the form when false. */
export const emailOtpEnabled = isEmailOtpEnabled();

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
  extraPlugins: [otpOwnerGuardPlugin],
});

/** RSC-safe session read — never refreshes cookies (see proxy /auth routes). */
export async function getSession(requestHeaders?: Headers) {
  return auth.api.getSession({
    headers: requestHeaders ?? (await headers()),
    query: { disableRefresh: true },
  });
}

export type Session = typeof auth.$Infer.Session;
