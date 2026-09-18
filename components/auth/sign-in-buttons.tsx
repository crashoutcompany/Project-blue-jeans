// shared:sign-in-buttons v2
"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import {
  AUTH_SIGN_IN_PATH,
  type SocialProvider,
} from "@/lib/auth/config";

const PROVIDER_LABELS: Record<SocialProvider, string> = {
  github: "GitHub",
  google: "Google",
};

export function SignInButtons({
  providers,
}: {
  providers: SocialProvider[];
}) {
  const [pendingProvider, setPendingProvider] =
    useState<SocialProvider | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function signIn(provider: SocialProvider) {
    setPendingProvider(provider);
    setErrorMessage(null);

    const result = await authClient.signIn.social({
      provider,
      callbackURL: "/",
      errorCallbackURL: AUTH_SIGN_IN_PATH,
    });

    if (result.error) {
      setErrorMessage(result.error.message || "Unable to sign in.");
      setPendingProvider(null);
    }
  }

  if (providers.length === 0) {
    return (
      <p role="status" className="mt-9 text-sm text-muted-foreground">
        No social sign-in providers are currently configured.
      </p>
    );
  }

  return (
    <div className="mt-9 flex flex-col gap-3">
      {providers.map((provider) => (
        <Button
          key={provider}
          type="button"
          className="h-12 w-full rounded-full"
          disabled={pendingProvider !== null}
          onClick={() => void signIn(provider)}
        >
          {pendingProvider === provider
            ? "Redirecting…"
            : `Sign in with ${PROVIDER_LABELS[provider]}`}
        </Button>
      ))}
      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
