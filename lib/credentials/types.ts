export const PROVIDERS = ["google_ai_studio", "uploadthing"] as const;

export type ProviderKind = (typeof PROVIDERS)[number];
export type CredentialSource = "platform_env" | "user_byok";

export type ProviderSecretByKind = {
  google_ai_studio: { apiKey: string };
  uploadthing: { token: string };
};

export type ProviderSecret = ProviderSecretByKind[ProviderKind];

export type ResolvedProviderCredential<P extends ProviderKind = ProviderKind> = {
  provider: P;
  source: CredentialSource;
  connectionId: string | null;
  secret: ProviderSecretByKind[P];
};

/**
 * BYOK keys are write-only: views and mutation results never carry any part
 * of the stored secret, so the client can only learn whether one is connected.
 */
export type GoogleAiStudioSettingsView = {
  funding: "platform" | "byok";
  canEdit: boolean;
  connected: boolean;
  testedAt: string | null;
};

export type UploadThingSettingsView = GoogleAiStudioSettingsView;

export type ProviderMutationResult =
  | { ok: true }
  | { ok: false; message: string; rateLimited?: true };
