import { memoryAdapter } from "better-auth/adapters/memory";
import { describe, expect, it, vi } from "vitest";

import {
  createAuth,
  getEnabledSocialProviders,
  resolveAuthEnvironment,
} from "./create-auth";
import { EMAIL_OTP_DISABLED_PATHS } from "./email-otp";

const resendSend = vi.hoisted(() =>
  vi.fn(async () => ({ data: { id: "email-id" }, error: null })),
);
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendSend };
  },
}));

const SECRET = "test-better-auth-secret-at-least-32-characters";
const ORIGIN = "http://localhost:3000";
const OTP_TABLES = { user: [], session: [], account: [], verification: [] };
const OTP_ENV = {
  AUTH_OTP_ALLOWED_EMAILS: "bot@example.com",
  RESEND_API_KEY: "re_test",
  AUTH_EMAIL_FROM: "auth@example.com",
};

describe("resolveAuthEnvironment", () => {
  it("requires BETTER_AUTH_SECRET and ignores the legacy AUTH_SECRET name", () => {
    const legacyEnvironment = {
      NODE_ENV: "test",
      AUTH_SECRET: "legacy-secret",
    };

    expect(() => resolveAuthEnvironment(legacyEnvironment)).toThrow(
      "BETTER_AUTH_SECRET environment variable is required",
    );
  });

  it("registers only providers with both credentials", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const environment = resolveAuthEnvironment({
      BETTER_AUTH_SECRET: SECRET,
      AUTH_GITHUB_ID: "github-id",
      AUTH_GITHUB_SECRET: "github-secret",
      AUTH_GOOGLE_ID: "google-id-only",
    });

    expect(environment.socialProviders).toEqual({
      github: {
        clientId: "github-id",
        clientSecret: "github-secret",
      },
    });
    expect(environment.enabledSocialProviders).toEqual(["github"]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("AUTH_GOOGLE_SECRET"),
    );

    warn.mockRestore();
  });

  it("reports enabled providers without warning about partial configuration", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(
      getEnabledSocialProviders({
        BETTER_AUTH_SECRET: SECRET,
        AUTH_GOOGLE_ID: "google-id",
        AUTH_GOOGLE_SECRET: "google-secret",
        AUTH_GITHUB_ID: "github-id-only",
      }),
    ).toEqual(["google"]);
    expect(warn).not.toHaveBeenCalled();

    warn.mockRestore();
  });
});

describe("createAuth email OTP", () => {
  it("registers the email OTP plugins only when email OTP is configured", () => {
    const build = (env: Record<string, string>) =>
      createAuth({
        appName: "Project Blue Jeans",
        database: memoryAdapter({}),
        env: { BETTER_AUTH_SECRET: SECRET, ...env },
        productionUrl: "http://localhost:3000",
        previewOrigin: "http://localhost:3000",
      }).options.plugins.map((plugin) => plugin.id);

    expect(build({})).not.toContain("email-otp");
    expect(build({ AUTH_OTP_ALLOWED_EMAILS: "bot@example.com" })).not.toContain(
      "email-otp",
    );
    expect(
      build({
        AUTH_OTP_ALLOWED_EMAILS: "bot@example.com",
        RESEND_API_KEY: "re_test",
        AUTH_EMAIL_FROM: "auth@example.com",
      }),
    ).toEqual(expect.arrayContaining(["email-otp", "email-otp-allowlist"]));
  });

  it("disables the non-sign-in OTP routes only when email OTP is configured", () => {
    const withOtp = createAuth({
      appName: "Project Blue Jeans",
      database: memoryAdapter({}),
      env: { BETTER_AUTH_SECRET: SECRET, ...OTP_ENV },
      productionUrl: ORIGIN,
      previewOrigin: ORIGIN,
    });
    const withoutOtp = createAuth({
      appName: "Project Blue Jeans",
      database: memoryAdapter({}),
      env: { BETTER_AUTH_SECRET: SECRET },
      productionUrl: ORIGIN,
      previewOrigin: ORIGIN,
    });

    expect(withOtp.options.disabledPaths).toEqual([...EMAIL_OTP_DISABLED_PATHS]);
    expect(withOtp.options.disabledPaths).toEqual(
      expect.arrayContaining([
        "/email-otp/reset-password",
        "/email-otp/verify-email",
        "/email-otp/check-verification-otp",
        "/email-otp/request-password-reset",
        "/forget-password/email-otp",
      ]),
    );
    expect(withoutOtp.options.disabledPaths).toBeUndefined();
  });

  it("answers 404 for disabled OTP routes", async () => {
    const auth = createAuth({
      appName: "Project Blue Jeans",
      database: memoryAdapter(OTP_TABLES),
      env: { BETTER_AUTH_SECRET: SECRET, ...OTP_ENV },
      productionUrl: ORIGIN,
      previewOrigin: ORIGIN,
    });

    for (const path of [
      "/email-otp/reset-password",
      "/email-otp/verify-email",
      "/email-otp/check-verification-otp",
      "/email-otp/request-password-reset",
    ]) {
      const response = await auth.handler(
        new Request(`${ORIGIN}/api/auth${path}`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: ORIGIN },
          body: JSON.stringify({ email: "bot@example.com", otp: "123456" }),
        }),
      );
      expect(response.status, path).toBe(404);
    }
  });
});

describe("createAuth rate limiting", () => {
  function buildOtpAuth(extraEnv: { NODE_ENV?: string } = {}) {
    return createAuth({
      appName: "Project Blue Jeans",
      database: memoryAdapter(OTP_TABLES),
      env: { BETTER_AUTH_SECRET: SECRET, ...OTP_ENV, ...extraEnv },
      productionUrl: ORIGIN,
      previewOrigin: "https://*-preview.vercel.app",
    });
  }

  // A new client IP per request, so only the per-email counters can trip.
  function post(
    auth: ReturnType<typeof buildOtpAuth>,
    path: string,
    body: object,
    ip: number,
  ) {
    return auth.handler(
      new Request(`${ORIGIN}/api/auth${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: ORIGIN,
          "x-forwarded-for": `10.1.${Math.floor(ip / 250)}.${(ip % 250) + 1}`,
        },
        body: JSON.stringify(body),
      }),
    );
  }

  it("wires the shared store and enables limiting only in production", () => {
    const auth = buildOtpAuth();
    const withoutOtp = createAuth({
      appName: "Project Blue Jeans",
      database: memoryAdapter({}),
      env: { BETTER_AUTH_SECRET: SECRET },
      productionUrl: ORIGIN,
      previewOrigin: "https://*-preview.vercel.app",
    });

    expect(auth.options.rateLimit?.enabled).toBe(false);
    expect(buildOtpAuth({ NODE_ENV: "production" }).options.rateLimit?.enabled).toBe(
      true,
    );
    expect(typeof auth.options.rateLimit?.customStorage?.consume).toBe("function");
    expect(typeof withoutOtp.options.rateLimit?.customStorage?.consume).toBe(
      "function",
    );
  });

  it("applies Better Auth's per-IP limit through the shared store in production", async () => {
    const auth = buildOtpAuth({ NODE_ENV: "production" });
    const statuses: number[] = [];

    // Default rule for /sign-in/email-otp: 3 requests per 60 seconds per IP.
    for (let i = 0; i < 4; i += 1) {
      const response = await post(
        auth,
        "/sign-in/email-otp",
        { email: `ip-${i}@example.com`, otp: "000000" },
        200,
      );
      statuses.push(response.status);
    }

    expect(statuses[3]).toBe(429);
    expect(statuses.slice(0, 3).every((status) => status !== 429)).toBe(true);
  });

  it("locks sends per email and IP, and answers unlisted addresses the same way", async () => {
    resendSend.mockClear();
    const auth = buildOtpAuth();

    // Listed: sends up to the email+IP limit, then the lockout body with no send.
    for (let i = 0; i < 5; i += 1) {
      const response = await post(
        auth,
        "/email-otp/send-verification-otp",
        { email: "bot@example.com", type: "sign-in" },
        10,
      );
      expect(response.status).toBe(200);
    }
    await vi.waitFor(() => expect(resendSend).toHaveBeenCalledTimes(5));

    const locked = await post(
      auth,
      "/email-otp/send-verification-otp",
      { email: "bot@example.com", type: "sign-in" },
      10,
    );
    expect(locked.status).toBe(200);
    expect(await locked.json()).toEqual({ success: true });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(resendSend).toHaveBeenCalledTimes(5);

    // Unlisted: the same over-limit body, and no send at any point.
    resendSend.mockClear();
    for (let i = 0; i < 6; i += 1) {
      const response = await post(
        auth,
        "/email-otp/send-verification-otp",
        { email: "stranger@example.com", type: "sign-in" },
        10,
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(resendSend).not.toHaveBeenCalled();
  });

  it("answers an unlisted email's sign-in with 429 and Retry-After only after the lockout", async () => {
    const auth = buildOtpAuth();
    const statuses: number[] = [];
    let locked: Response | undefined;

    for (let i = 0; i < 11; i += 1) {
      const response = await post(
        auth,
        "/sign-in/email-otp",
        { email: "stranger@example.com", otp: "000000" },
        100,
      );
      statuses.push(response.status);
      if (i === 10) locked = response;
    }

    expect(statuses.slice(0, 10).every((status) => status === 400)).toBe(true);
    expect(statuses[10]).toBe(429);
    expect(Number(locked?.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});
