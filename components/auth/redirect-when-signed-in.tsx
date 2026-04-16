"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth/client";

const REDIRECT_PATHS = new Set(["sign-in", "sign-up"]);

/**
 * Redirect away from sign-in / sign-up when a session already exists.
 */
export function RedirectWhenSignedIn({ path }: { path: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!REDIRECT_PATHS.has(path)) return;

    void authClient.getSession().then(({ data }) => {
      if (data?.session) router.replace("/dashboard");
    });
  }, [path, router]);

  return null;
}
