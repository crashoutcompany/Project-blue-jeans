"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import { NeonAuthUIProvider } from "@neondatabase/auth/react";

import { authClient } from "@/lib/auth/client";

type AuthClientProp = ComponentProps<typeof NeonAuthUIProvider>["authClient"];

export function NeonAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <NeonAuthUIProvider
      Link={Link}
      authClient={authClient as unknown as AuthClientProp}
      credentials={false}
      signUp={false}
      redirectTo="/"
      social={{ providers: ["google"] }}
      localization={{
        DISABLED_CREDENTIALS_DESCRIPTION:
          "Sign in with your Google account to continue.",
      }}
    >
      {children}
    </NeonAuthUIProvider>
  );
}
