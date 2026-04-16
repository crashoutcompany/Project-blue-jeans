import { AuthView } from "@neondatabase/auth/react";

import { RedirectWhenSignedIn } from "@/components/auth/redirect-when-signed-in";

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;

  return (
    <>
      <RedirectWhenSignedIn path={path} />
      <AuthView path={path} redirectTo="/dashboard" />
    </>
  );
}
