import "server-only";

import {
  getMembershipPolicy,
  membershipAllowsPlatformCredentials,
  MembershipStoreUnavailableError,
  type MembershipPolicy,
} from "@/lib/auth/membership";
import { normalizePastedSecret } from "@/lib/credentials/paste";
import type {
  ProviderKind,
  ProviderSecretByKind,
  ResolvedProviderCredential,
} from "@/lib/credentials/types";
import {
  getStoredProviderCredential,
  getStoredProviderCredentialByConnectionId,
} from "@/lib/credentials/vault";
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

function assertActiveMembership(
  userId: string,
  membership: MembershipPolicy | null,
): asserts membership is MembershipPolicy {
  if (!membership || membership.userId !== userId) {
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
}

/**
 * Policy always comes from the store (`getMembershipPolicy`, which already
 * covers the `APP_OWNER_USER_ID` bootstrap). Callers cannot hand in a
 * membership, so no code path can mint owner policy and spend platform keys.
 */
async function resolveWithMembership<P extends ProviderKind>(
  userId: string,
  provider: P,
  membership: MembershipPolicy | null,
): Promise<ResolvedProviderCredential<P>> {
  assertActiveMembership(userId, membership);

  if (membershipAllowsPlatformCredentials(membership, userId)) {
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

export async function resolveProviderCredential<P extends ProviderKind>(
  userId: string,
  provider: P,
): Promise<ResolvedProviderCredential<P>> {
  return resolveWithMembership(
    userId,
    provider,
    await getMembershipPolicy(userId),
  );
}

export async function resolveGeminiApiKey(
  userId: string,
): Promise<{ ok: true; apiKey: string } | { ok: false; message: string }> {
  try {
    const resolved = await resolveProviderCredential(
      userId,
      "google_ai_studio",
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

export type ResolvedUploadThingToken =
  | {
      ok: true;
      token: string;
      connectionId: string | null;
      source: "platform_env" | "user_byok";
    }
  | { ok: false; message: string };

/**
 * Callers branch on `ok`, so a membership store that cannot answer has to be
 * reported the same way rather than thrown past them as a 500.
 */
function uploadThingFailure(error: unknown): { ok: false; message: string } {
  if (error instanceof ProviderCredentialUnavailableError) {
    return { ok: false, message: uploadThingCredentialMessage(error) };
  }
  if (error instanceof MembershipStoreUnavailableError) {
    return { ok: false, message: error.message };
  }
  throw error;
}

export async function resolveUploadThingToken(
  userId: string,
): Promise<ResolvedUploadThingToken> {
  try {
    return uploadThingSuccess(
      await resolveProviderCredential(userId, "uploadthing"),
    );
  } catch (error) {
    return uploadThingFailure(error);
  }
}

function uploadThingSuccess(
  resolved: ResolvedProviderCredential<"uploadthing">,
): ResolvedUploadThingToken {
  return {
    ok: true,
    token: resolved.secret.token,
    connectionId: resolved.connectionId,
    source: resolved.source,
  };
}

/**
 * Resolve the token that owns a stored media connection. Platform-funded
 * accounts always use the env token. BYOK reads use the recorded connection
 * instead of whatever is currently default.
 */
export async function resolveUploadThingTokenForConnection(
  userId: string,
  connectionId: string | null | undefined,
): Promise<ResolvedUploadThingToken> {
  try {
    const membership = await getMembershipPolicy(userId);
    const recordedConnectionId = connectionId?.trim() || null;
    if (
      !recordedConnectionId ||
      membershipAllowsPlatformCredentials(membership, userId)
    ) {
      // Reuse the membership just read rather than querying it again.
      return uploadThingSuccess(
        await resolveWithMembership(userId, "uploadthing", membership),
      );
    }

    assertActiveMembership(userId, membership);
    const stored = await getStoredProviderCredentialByConnectionId(
      userId,
      recordedConnectionId,
      "uploadthing",
    );
    if (!stored) {
      throw new ProviderCredentialUnavailableError(
        "Connect uploadthing in Settings before using this feature.",
        "byok_credential_missing",
      );
    }
    return {
      ok: true,
      token: stored.secret.token,
      connectionId: stored.connectionId,
      source: "user_byok",
    };
  } catch (error) {
    return uploadThingFailure(error);
  }
}
