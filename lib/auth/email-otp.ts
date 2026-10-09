// shared:email-otp v1
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";
import { Resend } from "resend";

export type EmailOtpEnv = {
  AUTH_OTP_ALLOWED_EMAILS?: string;
  RESEND_API_KEY?: string;
  AUTH_EMAIL_FROM?: string;
};

export const EMAIL_OTP_EXPIRES_IN_SECONDS = 300;
export const EMAIL_OTP_ALLOWED_ATTEMPTS = 3;
export const EMAIL_OTP_LENGTH = 6;

export type EmailOtpConfig = {
  allowlist: string[];
  from: string;
  resendApiKey: string;
};

/**
 * Routes that redeem a code. A non-allowlisted email is rejected here, before
 * Better Auth looks the code up. Send routes are not listed: they always
 * answer the same way so the allowlist can't be probed.
 */
const OTP_REDEEM_PATHS: readonly string[] = [
  "/sign-in/email-otp",
  "/email-otp/verify-email",
  "/email-otp/check-verification-otp",
  "/email-otp/reset-password",
];

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Comma-separated → trimmed, lowercased, empties dropped, de-duplicated. */
export function parseOtpAllowlist(raw: string | undefined): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(",").map(normalizeEmail).filter(Boolean))];
}

export function isOtpEmailAllowed(
  email: string,
  allowlist: readonly string[],
): boolean {
  const normalized = normalizeEmail(email);
  return normalized !== "" && allowlist.includes(normalized);
}

export function resolveEmailOtpConfig(
  env: EmailOtpEnv,
  warnOnPartialConfig: boolean,
): EmailOtpConfig | null {
  const allowlist = parseOtpAllowlist(env.AUTH_OTP_ALLOWED_EMAILS);
  const resendApiKey = env.RESEND_API_KEY?.trim();
  const from = env.AUTH_EMAIL_FROM?.trim();

  if (allowlist.length > 0 && resendApiKey && from) {
    return { allowlist, from, resendApiKey };
  }

  if (warnOnPartialConfig && (allowlist.length > 0 || resendApiKey || from)) {
    console.warn(
      "[auth] email OTP sign-in is disabled: set AUTH_OTP_ALLOWED_EMAILS, RESEND_API_KEY and AUTH_EMAIL_FROM.",
    );
  }
  return null;
}

/** Server-computed flag for the sign-in UI. */
export function isEmailOtpEnabled(
  // Cast: Next types ProcessEnv without an index signature (weak-type check).
  env: EmailOtpEnv = process.env as EmailOtpEnv,
): boolean {
  return resolveEmailOtpConfig(env, false) !== null;
}

export async function sendSignInOtpEmail(
  config: EmailOtpConfig,
  { appName, email, otp }: { appName: string; email: string; otp: string },
): Promise<void> {
  const resend = new Resend(config.resendApiKey);
  const { error } = await resend.emails.send({
    from: config.from,
    to: email,
    subject: `${appName} sign-in code`,
    text: `Your ${appName} sign-in code is ${otp}. It expires in 5 minutes.`,
  });
  if (error) {
    throw new Error(`[auth] failed to send sign-in code: ${error.message}`);
  }
}

function bodyEmail(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("email" in body)) return null;
  return typeof body.email === "string" ? body.email : null;
}

/**
 * Email OTP for allowlisted accounts only (bots that can't pass OAuth). Only
 * `sign-in` codes are ever sent; other types and other emails silently no-op.
 */
export function createEmailOtpPlugins(
  config: EmailOtpConfig,
  appName: string,
): BetterAuthPlugin[] {
  const allowlistGuard = {
    id: "email-otp-allowlist",
    hooks: {
      before: [
        {
          matcher: (ctx) => OTP_REDEEM_PATHS.includes(ctx.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            const email = bodyEmail(ctx.body);
            if (email === null || !isOtpEmailAllowed(email, config.allowlist)) {
              throw new APIError("BAD_REQUEST", {
                message: "Invalid OTP",
                code: "INVALID_OTP",
              });
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;

  return [
    emailOTP({
      otpLength: EMAIL_OTP_LENGTH,
      expiresIn: EMAIL_OTP_EXPIRES_IN_SECONDS,
      allowedAttempts: EMAIL_OTP_ALLOWED_ATTEMPTS,
      disableSignUp: false,
      async sendVerificationOTP({ email, otp, type }) {
        if (type !== "sign-in" || !isOtpEmailAllowed(email, config.allowlist)) {
          return;
        }
        await sendSignInOtpEmail(config, { appName, email, otp });
      },
    }),
    allowlistGuard,
  ];
}
