import "server-only";

import { getMembershipPolicy } from "@/lib/auth/membership";
import type {
  ProviderKind,
  ProviderSecretByKind,
  ResolvedProviderCredential,
} from "@/lib/credentials/types";
import { getStoredProviderCredential } from "@/lib/credentials/vault";

export class ProviderCredentialUnavailableError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_admitted"
      | "membership_inactive"
      | "platform_credential_missing"
      | "byok_credential_missing",
  ) {
    super(message);
    this.name = "ProviderCredentialUnavailableError";
  }
}

export function googleAiStudioEnvApiKey(): string | null {
  let key = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!key) return null;
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  if (key.startsWith("=")) key = key.slice(1).trim();
  return key || null;
}

function platformSecret<P extends ProviderKind>(
  provider: P,
): ProviderSecretByKind[P] | null {
  if (provider === "google_ai_studio") {
    const apiKey = googleAiStudioEnvApiKey();
    return (apiKey ? { apiKey } : null) as ProviderSecretByKind[P] | null;
  }

  const token = process.env.UPLOADTHING_TOKEN?.trim();
  return (token ? { token } : null) as ProviderSecretByKind[P] | null;
}

export async function resolveProviderCredential<P extends ProviderKind>(
  userId: string,
  provider: P,
): Promise<ResolvedProviderCredential<P>> {
  const membership = await getMembershipPolicy(userId);
  if (!membership) {
    throw new ProviderCredentialUnavailableError(
      "This account has not been admitted to Blue Jeans.",
      "not_admitted",
    );
  }
  if (membership.status !== "active") {
    throw new ProviderCredentialUnavailableError(
      "This account is not active.",
      "membership_inactive",
    );
  }

  if (membership.credentialSource === "platform_env") {
    const secret = platformSecret(provider);
    if (!secret) {
      throw new ProviderCredentialUnavailableError(
        `The platform ${provider} credential is not configured.`,
        "platform_credential_missing",
      );
    }
    return {
      provider,
      source: "platform_env",
      connectionId: null,
      secret,
    };
  }

  const stored = await getStoredProviderCredential(userId, provider);
  if (!stored) {
    throw new ProviderCredentialUnavailableError(
      `Connect ${provider} in Settings before using this feature.`,
      "byok_credential_missing",
    );
  }
  return {
    provider,
    source: "user_byok",
    connectionId: stored.connectionId,
    secret: stored.secret,
  };
}
