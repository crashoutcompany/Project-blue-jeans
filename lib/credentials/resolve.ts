import "server-only";

import {
  getMembershipPolicy,
  type MembershipPolicy,
} from "@/lib/auth/membership";
import { normalizePastedSecret } from "@/lib/credentials/paste";
import type {
  ProviderKind,
  ProviderSecretByKind,
  ResolvedProviderCredential,
} from "@/lib/credentials/types";
import { getStoredProviderCredential } from "@/lib/credentials/vault";
import { safeClientMessage } from "@/lib/server/safe-client-error";

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
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) return null;
  return normalizePastedSecret(key) || null;
}

export function uploadThingEnvToken(): string | null {
  const token = process.env.UPLOADTHING_TOKEN;
  if (!token) return null;
  return normalizePastedSecret(token) || null;
}

export function geminiCredentialMessage(
  error: ProviderCredentialUnavailableError,
): string {
  switch (error.code) {
    case "byok_credential_missing":
      return "Connect Google AI Studio in Settings before using this feature.";
    case "platform_credential_missing":
      return "Missing Gemini credentials. Set GOOGLE_GENERATIVE_AI_API_KEY (see docs/gemini-ai-studio-env.md).";
    case "membership_inactive":
      return "This account is not active.";
    case "not_admitted":
      return "This account has not been admitted to Blue Jeans.";
  }
}

function platformSecret<P extends ProviderKind>(
  provider: P,
): ProviderSecretByKind[P] | null {
  if (provider === "google_ai_studio") {
    const apiKey = googleAiStudioEnvApiKey();
    return (apiKey ? { apiKey } : null) as ProviderSecretByKind[P] | null;
  }

  const token = uploadThingEnvToken();
  return (token ? { token } : null) as ProviderSecretByKind[P] | null;
}

export async function resolveProviderCredential<P extends ProviderKind>(
  userId: string,
  provider: P,
  membershipInput?: MembershipPolicy | null,
): Promise<ResolvedProviderCredential<P>> {
  const membership =
    membershipInput === undefined
      ? await getMembershipPolicy(userId)
      : membershipInput;
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

export async function resolveGeminiApiKey(
  userId: string,
  fallbackMembership?: MembershipPolicy | null,
): Promise<{ ok: true; apiKey: string } | { ok: false; message: string }> {
  try {
    const fromDb = await getMembershipPolicy(userId);
    const membership = fromDb ?? fallbackMembership ?? null;
    const resolved = await resolveProviderCredential(
      userId,
      "google_ai_studio",
      membership,
    );
    return { ok: true, apiKey: resolved.secret.apiKey };
  } catch (error) {
    if (error instanceof ProviderCredentialUnavailableError) {
      return { ok: false, message: geminiCredentialMessage(error) };
    }
    return {
      ok: false,
      message: safeClientMessage(
        "resolveGeminiApiKey",
        error,
        "Google AI Studio credentials could not be read. Try again in a moment.",
      ),
    };
  }
}

export function uploadThingCredentialMessage(
  error: ProviderCredentialUnavailableError,
): string {
  switch (error.code) {
    case "byok_credential_missing":
      return "Connect UploadThing in Settings before uploading photos.";
    case "platform_credential_missing":
      return "Missing UploadThing credentials. Set UPLOADTHING_TOKEN.";
    case "membership_inactive":
      return "This account is not active.";
    case "not_admitted":
      return "This account has not been admitted to Blue Jeans.";
  }
}

export async function resolveUploadThingToken(
  userId: string,
  fallbackMembership?: MembershipPolicy | null,
): Promise<
  | {
      ok: true;
      token: string;
      connectionId: string | null;
      source: "platform_env" | "user_byok";
    }
  | { ok: false; message: string }
> {
  const fromDb = await getMembershipPolicy(userId);
  const membership = fromDb ?? fallbackMembership ?? null;
  try {
    const resolved = await resolveProviderCredential(
      userId,
      "uploadthing",
      membership,
    );
    return {
      ok: true,
      token: resolved.secret.token,
      connectionId: resolved.connectionId,
      source: resolved.source,
    };
  } catch (error) {
    if (error instanceof ProviderCredentialUnavailableError) {
      return { ok: false, message: uploadThingCredentialMessage(error) };
    }
    throw error;
  }
}
