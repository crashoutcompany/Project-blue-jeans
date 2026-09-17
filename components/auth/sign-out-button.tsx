"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export function SignOutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function signOut() {
    setIsPending(true);
    await authClient.signOut();
    router.push("/signin");
    router.refresh();
  }

  return (
    <Button
      type="button"
      size="lg"
      className="rounded-full"
      disabled={isPending}
      onClick={() => void signOut()}
    >
      {isPending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
