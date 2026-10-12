import "server-only";

import { isPlatformFundedOwner, type MembershipPolicy } from "@/lib/auth/membership";
import { uploadThingEnvToken } from "@/lib/credentials/resolve";
import type {
  ProviderMutationResult,
  UploadThingSettingsView,
} from "@/lib/credentials/types";
import { validateUploadThingToken } from "@/lib/credentials/validate-uploadthing";
import {
  CredentialVaultError,
  getByokConnectionPublic,
  revokeByokCredential,
  saveByokCredential,
} from "@/lib/credentials/vault";
import {
  consumeValidationAttempt,
  VALIDATION_RATE_LIMITED_MESSAGE,
} from "@/lib/credentials/validation-rate-limit";

export type { ProviderMutationResult, UploadThingSettingsView };

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
  if (isPlatformFundedOwner(membership)) {
    return {
      funding: "platform",
      canEdit: false,
      connected: Boolean(uploadThingEnvToken()),
      testedAt: null,
    };
  }

  const connection = await getByokConnectionPublic(userId, "uploadthing");
  const connected =
    connection?.status === "active" && connection.hasCredential;

  return {
    funding: "byok",
    canEdit: true,
    connected,
    testedAt: connected ? connection?.testedAt ?? null : null,
  };
}

export async function saveUploadThingByok(
  userId: string,
  membership: MembershipPolicy,
  rawToken: string,
): Promise<ProviderMutationResult> {
  if (isPlatformFundedOwner(membership)) {
    return {
      ok: false,
      message: "Platform-funded accounts use the environment UploadThing token.",
    };
  }

  if (!(await consumeValidationAttempt(userId, "uploadthing"))) {
    return {
      ok: false,
      message: VALIDATION_RATE_LIMITED_MESSAGE,
      rateLimited: true,
    };
  }

  const validated = await validateUploadThingToken(rawToken);
  if (!validated.ok) return validated;

  const testedAt = new Date();
  try {
    await saveByokCredential({
      userId,
      provider: "uploadthing",
      secret: { token: validated.token },
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

  return { ok: true };
}

export async function revokeUploadThingByok(
  userId: string,
  membership: MembershipPolicy,
): Promise<ProviderMutationResult> {
  if (isPlatformFundedOwner(membership)) {
    return {
      ok: false,
      message: "Platform-funded accounts use the environment UploadThing token.",
    };
  }

  await revokeByokCredential(userId, "uploadthing");
  return { ok: true };
}
