export const AUTH_PRODUCTION_URL = "https://project-blue-jeans.vercel.app";
export const AUTH_PREVIEW_ORIGIN =
  "https://*-crashoutcos-projects.vercel.app";
export const AUTH_SIGN_IN_PATH = "/signin";
/** Alias for shared sign-in button / RDC copy-paste. */
export const SIGN_IN_PATH = AUTH_SIGN_IN_PATH;
export const PRODUCTION_URL = AUTH_PRODUCTION_URL;
export const PREVIEW_ORIGIN = AUTH_PREVIEW_ORIGIN;

export type SocialProvider = "github" | "google";

export const TEST_AUTH_HEADER = "x-test-auth-secret";
export const TESTER_ID = "preview-tester";
export const TESTER_EMAIL = "tester@preview.project-blue-jeans.local";
export const TESTER_NAME = "Preview Tester";
export const NON_ADMITTED_TESTER_ID = "preview-non-admitted";
export const NON_ADMITTED_TESTER_EMAIL =
  "non-admitted@preview.project-blue-jeans.local";
export const NON_ADMITTED_TESTER_NAME = "Preview Non-Admitted Tester";
