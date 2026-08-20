import "server-only";

import type { MembershipPolicy } from "@/lib/auth/membership";
import { secretHint } from "@/lib/credentials/paste";
import { uploadThingEnvToken } from "@/lib/credentials/resolve";
import type { UploadThingSettingsView } from "@/lib/credentials/types";
import { validateUploadThingToken } from "@/lib/credentials/validate-uploadthing";
import {
  CredentialVaultError,
  getByokConnectionPublic,
  revokeByokCredential,
  saveByokCredential,
} from "@/lib/credentials/vault";

export type { UploadThingSettingsView };

export type ProviderMutationResult =
  | { ok: true; secretHint?: string | null }
  | { ok: false; message: string };

function isUploadThingAppTaken(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? error.code : undefined;
  const constraint =
    "constraint" in error ? error.constraint : undefined;
  if (code !== "23505") return false;
  return (
    constraint === "provider_connections_uploadthing_app_uidx" ||
    constraint === undefined
  );
}

export async function getUploadThingSettings(
  userId: string,
  membership: MembershipPolicy,
): Promise<UploadThingSettingsView> {
  if (membership.credentialSource === "platform_env") {
    return {
      funding: "platform",
      canEdit: false,
      connected: Boolean(uploadThingEnvToken()),
      secretHint: null,
      testedAt: null,
    };
  }

  const connection = await getByokConnectionPublic(userId, "uploadthing");
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

export async function saveUploadThingByok(
  userId: string,
  membership: MembershipPolicy,
  rawToken: string,
): Promise<ProviderMutationResult> {
  if (membership.credentialSource !== "user_byok") {
    return {
      ok: false,
      message: "Platform-funded accounts use the environment UploadThing token.",
    };
  }

  const validated = await validateUploadThingToken(rawToken);
  if (!validated.ok) return validated;

  const testedAt = new Date();
  const hint = secretHint(validated.token);
  try {
    await saveByokCredential({
      userId,
      provider: "uploadthing",
      secret: { token: validated.token },
      secretHint: hint,
      externalAccountId: validated.appId,
      testedAt,
    });
  } catch (error) {
    if (
      error instanceof CredentialVaultError &&
      error.code === "account_mismatch"
    ) {
      return {
        ok: false,
        message:
          "Reconnect with a token from the same UploadThing app. A different app would make existing photos unreadable.",
      };
    }
    if (isUploadThingAppTaken(error)) {
      return {
        ok: false,
        message:
          "That UploadThing app is already connected to another Wearer.",
      };
    }
    throw error;
  }

  return { ok: true, secretHint: hint };
}

export async function revokeUploadThingByok(
  userId: string,
  membership: MembershipPolicy,
): Promise<ProviderMutationResult> {
  if (membership.credentialSource !== "user_byok") {
    return {
      ok: false,
      message: "Platform-funded accounts use the environment UploadThing token.",
    };
  }

  await revokeByokCredential(userId, "uploadthing");
  return { ok: true };
}
