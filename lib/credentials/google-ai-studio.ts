import "server-only";

import { isPlatformFundedOwner, type MembershipPolicy } from "@/lib/auth/membership";
import { googleAiStudioEnvApiKey } from "@/lib/credentials/resolve";
import type {
  ProviderMutationResult,
  GoogleAiStudioSettingsView,
} from "@/lib/credentials/types";
import { validateGoogleAiStudioApiKey } from "@/lib/credentials/validate-google-ai";
import {
  getByokConnectionPublic,
  revokeByokCredential,
  saveByokCredential,
} from "@/lib/credentials/vault";
import {
  consumeValidationAttempt,
  VALIDATION_RATE_LIMITED_MESSAGE,
} from "@/lib/credentials/validation-rate-limit";

export type { ProviderMutationResult, GoogleAiStudioSettingsView };

export async function getGoogleAiStudioSettings(
  userId: string,
  membership: MembershipPolicy,
): Promise<GoogleAiStudioSettingsView> {
  if (isPlatformFundedOwner(membership)) {
    return {
      funding: "platform",
      canEdit: false,
      connected: Boolean(googleAiStudioEnvApiKey()),
      testedAt: null,
    };
  }

  const connection = await getByokConnectionPublic(userId, "google_ai_studio");
  const connected =
    connection?.status === "active" && connection.hasCredential;

  return {
    funding: "byok",
    canEdit: true,
    connected,
    testedAt: connected ? connection?.testedAt ?? null : null,
  };
}

export async function saveGoogleAiStudioByok(
  userId: string,
  membership: MembershipPolicy,
  rawKey: string,
): Promise<ProviderMutationResult> {
  if (isPlatformFundedOwner(membership)) {
    return {
      ok: false,
      message: "Platform-funded accounts use the environment Google AI Studio key.",
    };
  }

  if (!(await consumeValidationAttempt(userId, "google_ai_studio"))) {
    return {
      ok: false,
      message: VALIDATION_RATE_LIMITED_MESSAGE,
      rateLimited: true,
    };
  }

  const validated = await validateGoogleAiStudioApiKey(rawKey);
  if (!validated.ok) return validated;

  const testedAt = new Date();
  await saveByokCredential({
    userId,
    provider: "google_ai_studio",
    secret: { apiKey: validated.apiKey },
    testedAt,
  });

  return { ok: true };
}

export async function revokeGoogleAiStudioByok(
  userId: string,
  membership: MembershipPolicy,
): Promise<ProviderMutationResult> {
  if (isPlatformFundedOwner(membership)) {
    return {
      ok: false,
      message: "Platform-funded accounts use the environment Google AI Studio key.",
    };
  }

  await revokeByokCredential(userId, "google_ai_studio");
  return { ok: true };
}
