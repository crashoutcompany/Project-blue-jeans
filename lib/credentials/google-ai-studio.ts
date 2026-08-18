import "server-only";

import type { MembershipPolicy } from "@/lib/auth/membership";
import { secretHint } from "@/lib/credentials/paste";
import { googleAiStudioEnvApiKey } from "@/lib/credentials/resolve";
import type { GoogleAiStudioSettingsView } from "@/lib/credentials/types";
import { validateGoogleAiStudioApiKey } from "@/lib/credentials/validate-google-ai";
import {
  getByokConnectionPublic,
  revokeByokCredential,
  saveByokCredential,
} from "@/lib/credentials/vault";

export type { GoogleAiStudioSettingsView };

export type ProviderMutationResult =
  | { ok: true; secretHint?: string | null }
  | { ok: false; message: string };

export async function getGoogleAiStudioSettings(
  userId: string,
  membership: MembershipPolicy,
): Promise<GoogleAiStudioSettingsView> {
  if (membership.credentialSource === "platform_env") {
    return {
      funding: "platform",
      canEdit: false,
      connected: Boolean(googleAiStudioEnvApiKey()),
      secretHint: null,
      testedAt: null,
    };
  }

  const connection = await getByokConnectionPublic(userId, "google_ai_studio");
  const connected =
    connection?.status === "active" && Boolean(connection.secretHint);

  return {
    funding: "byok",
    canEdit: true,
    connected,
    secretHint: connected ? connection?.secretHint ?? null : null,
    testedAt: connected ? connection?.testedAt ?? null : null,
  };
}

export async function saveGoogleAiStudioByok(
  userId: string,
  membership: MembershipPolicy,
  rawKey: string,
): Promise<ProviderMutationResult> {
  if (membership.credentialSource !== "user_byok") {
    return {
      ok: false,
      message: "Platform-funded accounts use the environment Google AI Studio key.",
    };
  }

  const validated = await validateGoogleAiStudioApiKey(rawKey);
  if (!validated.ok) return validated;

  const testedAt = new Date();
  const hint = secretHint(validated.apiKey);
  await saveByokCredential({
    userId,
    provider: "google_ai_studio",
    secret: { apiKey: validated.apiKey },
    secretHint: hint,
    testedAt,
  });

  return { ok: true, secretHint: hint };
}

export async function revokeGoogleAiStudioByok(
  userId: string,
  membership: MembershipPolicy,
): Promise<ProviderMutationResult> {
  if (membership.credentialSource !== "user_byok") {
    return {
      ok: false,
      message: "Platform-funded accounts use the environment Google AI Studio key.",
    };
  }

  await revokeByokCredential(userId, "google_ai_studio");
  return { ok: true };
}
