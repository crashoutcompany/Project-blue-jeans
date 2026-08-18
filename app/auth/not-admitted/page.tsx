import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { assertAdmittedSession } from "@/lib/auth/admitted";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Invite required",
  robots: { index: false, follow: false },
};

async function NotAdmittedGate() {
  await connection();
  noStore();
  const gate = await assertAdmittedSession();
  if (gate.ok) {
    redirect("/");
  }
  if (gate.status === 401) {
    redirect("/auth/sign-in");
  }
  return null;
}

function NotAdmittedBody() {
  return (
    <div
      className="flex min-h-svh flex-col items-center justify-center bg-background px-6 py-16"
      data-testid="not-admitted-shell-marker"
    >
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="font-serif text-3xl tracking-tight text-foreground">
          Invite only
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          You’re signed in, but this account has not been admitted to Blue
          Jeans. Ask the owner for an invite, then open that link while signed
          in with the invited email.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/auth/sign-out"
            className={cn(buttonVariants({ size: "lg" }), "rounded-full")}
          >
            Sign out
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function NotAdmittedPage() {
  return (
    <>
      <Suspense fallback={null}>
        <NotAdmittedGate />
      </Suspense>
      <NotAdmittedBody />
    </>
  );
}
