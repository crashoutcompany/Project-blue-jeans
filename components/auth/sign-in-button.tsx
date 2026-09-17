"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export function SignInButton() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setIsPending(true);
    setError(null);

    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
      errorCallbackURL: "/signin",
    });

    if (result.error) {
      setError(result.error.message || "Unable to sign in.");
      setIsPending(false);
    }
  }

  return (
    <div className="mt-9 space-y-3">
      <Button
        type="button"
        className="h-12 w-full rounded-full"
        disabled={isPending}
        onClick={() => void signInWithGoogle()}
      >
        {isPending ? "Connecting…" : "Continue with Google"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
