import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: vi.fn(function Resend() {
    return { emails: { send: hoisted.send } };
  }),
}));

import {
  createEmailOtpPlugins,
  EMAIL_OTP_ALLOWED_ATTEMPTS,
  EMAIL_OTP_EXPIRES_IN_SECONDS,
  EMAIL_OTP_LENGTH,
  isEmailOtpEnabled,
  isOtpEmailAllowed,
  parseOtpAllowlist,
  resolveEmailOtpConfig,
  sendSignInOtpEmail,
  type EmailOtpConfig,
} from "./email-otp";

const BASE_URL = "http://localhost:3000";
const CONFIG: EmailOtpConfig = {
  allowlist: ["bot@example.com"],
  from: "Test App <auth@example.com>",
  resendApiKey: "re_test",
};
const FULL_ENV = {
  AUTH_OTP_ALLOWED_EMAILS: "bot@example.com",
  RESEND_API_KEY: "re_test",
  AUTH_EMAIL_FROM: "Test App <auth@example.com>",
};

function buildAuth(
  config: EmailOtpConfig = CONFIG,
  db: Record<string, unknown[]> = {
    user: [],
    session: [],
    account: [],
    verification: [],
  },
) {
  const auth = betterAuth({
    appName: "Test App",
    baseURL: BASE_URL,
    secret: "test-better-auth-secret-at-least-32-characters",
    database: memoryAdapter(db),
    plugins: createEmailOtpPlugins(config, "Test App"),
  });
  return { auth, db };
}

function post(auth: ReturnType<typeof buildAuth>["auth"], path: string, body: unknown) {
  return auth.handler(
    new Request(`${BASE_URL}/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify(body),
    }),
  );
}

function sentOtp(): string {
  const text = hoisted.send.mock.calls.at(-1)?.[0]?.text as string | undefined;
  const otp = text?.match(/\b(\d{6})\b/)?.[1];
  if (!otp) throw new Error("no code was sent");
  return otp;
}

beforeEach(() => {
  hoisted.send.mockReset();
  hoisted.send.mockResolvedValue({ data: { id: "email-id" }, error: null });
});

describe("parseOtpAllowlist", () => {
  it("trims, lowercases, drops empties and dedupes", () => {
    expect(
      parseOtpAllowlist(" Bot@Example.com , ,second@example.com,bot@example.com"),
    ).toEqual(["bot@example.com", "second@example.com"]);
  });

  it("returns an empty list for unset or blank input", () => {
    expect(parseOtpAllowlist(undefined)).toEqual([]);
    expect(parseOtpAllowlist(" , ,")).toEqual([]);
  });
});

describe("isOtpEmailAllowed", () => {
  it("matches case- and whitespace-insensitively", () => {
    expect(isOtpEmailAllowed(" BOT@example.com ", CONFIG.allowlist)).toBe(true);
    expect(isOtpEmailAllowed("other@example.com", CONFIG.allowlist)).toBe(false);
    expect(isOtpEmailAllowed("", CONFIG.allowlist)).toBe(false);
  });
});

describe("resolveEmailOtpConfig", () => {
  it("returns the config when the allowlist and Resend are set", () => {
    expect(resolveEmailOtpConfig(FULL_ENV, false)).toEqual(CONFIG);
    expect(isEmailOtpEnabled(FULL_ENV)).toBe(true);
  });

  it("returns null and warns when sending is not configured", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(
      resolveEmailOtpConfig({ ...FULL_ENV, RESEND_API_KEY: "" }, true),
    ).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      "[auth] email OTP sign-in is disabled: set AUTH_OTP_ALLOWED_EMAILS, RESEND_API_KEY and AUTH_EMAIL_FROM.",
    );
    expect(isEmailOtpEnabled({ ...FULL_ENV, AUTH_EMAIL_FROM: undefined })).toBe(
      false,
    );

    warn.mockRestore();
  });

  it("returns null without warning when nothing is set", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(resolveEmailOtpConfig({}, true)).toBeNull();
    expect(
      resolveEmailOtpConfig({ ...FULL_ENV, AUTH_OTP_ALLOWED_EMAILS: " , " }, false),
    ).toBeNull();
    expect(warn).not.toHaveBeenCalled();

    warn.mockRestore();
  });
});

describe("sendSignInOtpEmail", () => {
  it("sends a plain-text code with the app name and expiry", async () => {
    await sendSignInOtpEmail(CONFIG, {
      appName: "Test App",
      email: "bot@example.com",
      otp: "123456",
    });

    expect(hoisted.send).toHaveBeenCalledWith({
      from: CONFIG.from,
      to: "bot@example.com",
      subject: "Test App sign-in code",
      text: "Your Test App sign-in code is 123456. It expires in 5 minutes.",
    });
  });

  it("throws when Resend returns an error", async () => {
    hoisted.send.mockResolvedValue({
      data: null,
      error: { message: "domain not verified" },
    });

    await expect(
      sendSignInOtpEmail(CONFIG, {
        appName: "Test App",
        email: "bot@example.com",
        otp: "123456",
      }),
    ).rejects.toThrow("domain not verified");
  });
});

describe("createEmailOtpPlugins", () => {
  it("uses tight defaults", () => {
    expect(EMAIL_OTP_EXPIRES_IN_SECONDS).toBe(300);
    expect(EMAIL_OTP_ALLOWED_ATTEMPTS).toBe(3);
    expect(EMAIL_OTP_LENGTH).toBe(6);
    expect(createEmailOtpPlugins(CONFIG, "Test App").map((p) => p.id)).toEqual([
      "email-otp",
      "email-otp-allowlist",
    ]);
  });

  it("sends nothing to a non-allowlisted email but returns the same response", async () => {
    const { auth } = buildAuth();

    const listed = await post(auth, "/email-otp/send-verification-otp", {
      email: "bot@example.com",
      type: "sign-in",
    });
    const unlisted = await post(auth, "/email-otp/send-verification-otp", {
      email: "intruder@example.com",
      type: "sign-in",
    });

    expect(listed.status).toBe(200);
    expect(unlisted.status).toBe(listed.status);
    expect(await unlisted.json()).toEqual(await listed.json());
    expect(hoisted.send).toHaveBeenCalledTimes(1);
    expect(hoisted.send.mock.calls[0]?.[0].to).toBe("bot@example.com");
  });

  it("only sends sign-in codes", async () => {
    const { auth, db } = buildAuth();
    db.user.push({
      id: "bot-user",
      email: "bot@example.com",
      name: "Bot",
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    for (const type of ["email-verification", "forget-password"]) {
      await post(auth, "/email-otp/send-verification-otp", {
        email: "bot@example.com",
        type,
      });
    }
    await post(auth, "/email-otp/request-password-reset", {
      email: "bot@example.com",
    });

    expect(hoisted.send).not.toHaveBeenCalled();
  });

  it("signs in an allowlisted email with the emailed code", async () => {
    const { auth, db } = buildAuth();

    await post(auth, "/email-otp/send-verification-otp", {
      email: "Bot@Example.com",
      type: "sign-in",
    });
    const response = await post(auth, "/sign-in/email-otp", {
      email: "bot@example.com",
      otp: sentOtp(),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("session_token");
    expect(db.user).toHaveLength(1);
  });

  it("rejects sign-in for a non-allowlisted email even with a valid code", async () => {
    // A code issued while the email was listed stops working once it's removed.
    const listed = buildAuth({
      ...CONFIG,
      allowlist: ["bot@example.com", "removed@example.com"],
    });
    await post(listed.auth, "/email-otp/send-verification-otp", {
      email: "removed@example.com",
      type: "sign-in",
    });
    const otp = sentOtp();
    const { auth, db } = buildAuth(CONFIG, listed.db);

    const response = await post(auth, "/sign-in/email-otp", {
      email: "removed@example.com",
      otp,
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(db.user).toHaveLength(0);
    expect(db.session).toHaveLength(0);
  });
});
