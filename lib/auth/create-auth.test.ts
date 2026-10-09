import { memoryAdapter } from "better-auth/adapters/memory";
import { describe, expect, it, vi } from "vitest";

import {
  createAuth,
  getEnabledSocialProviders,
  resolveAuthEnvironment,
} from "./create-auth";

const SECRET = "test-better-auth-secret-at-least-32-characters";

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
});
