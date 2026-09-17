export const AUTH_PRODUCTION_URL = "https://project-blue-jeans.vercel.app";
export const AUTH_PREVIEW_ORIGIN =
  "https://*-crashoutcos-projects.vercel.app";
export const AUTH_SIGN_IN_PATH = "/signin";

export const TEST_AUTH_HEADER = "x-test-auth-secret";
export const TESTER_ID = "preview-tester";
export const TESTER_EMAIL = "tester@preview.project-blue-jeans.local";
export const TESTER_NAME = "Preview Tester";
export const NON_ADMITTED_TESTER_ID = "preview-non-admitted";
export const NON_ADMITTED_TESTER_EMAIL =
  "non-admitted@preview.project-blue-jeans.local";
export const NON_ADMITTED_TESTER_NAME = "Preview Non-Admitted Tester";

type AuthUrlEnv = {
  BETTER_AUTH_URL?: string;
  NODE_ENV?: string;
  PORT?: string;
  VERCEL_BRANCH_URL?: string;
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
};

function isLoopbackUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

/**
 * BETTER_AUTH_URL is the explicit override. Preview deployments use their
 * branch URL so OAuth callbacks return to the deployment that started them.
 */
export function resolveAuthBaseUrl(env: AuthUrlEnv = process.env): string {
  const configured = env.BETTER_AUTH_URL?.trim();
  const isProductionBuild = env.NODE_ENV === "production";

  if (configured && (!isProductionBuild || !isLoopbackUrl(configured))) {
    return configured;
  }

  if (env.VERCEL_ENV === "preview") {
    const previewHost = env.VERCEL_BRANCH_URL || env.VERCEL_URL;
    if (previewHost) return `https://${previewHost}`;
  }

  if (isProductionBuild) return AUTH_PRODUCTION_URL;
  return `http://localhost:${env.PORT || "3000"}`;
}
