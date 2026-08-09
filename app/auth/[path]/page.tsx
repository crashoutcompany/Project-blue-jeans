import { Suspense } from "react";
import { AuthView } from "@neondatabase/auth/react";

import { RedirectWhenSignedIn } from "@/components/auth/redirect-when-signed-in";

async function AuthPageContent({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;

  return (
    <div data-testid="auth-content">
      <RedirectWhenSignedIn path={path} />
      <AuthView path={path} redirectTo="/" />
    </div>
  );
}

export default function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  return (
    <div data-testid="auth-shell-marker" className="min-h-svh bg-background">
      <Suspense
        fallback={
          <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        }
      >
        <AuthPageContent params={params} />
      </Suspense>
    </div>
  );
}
