import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { isAdminUser } from "@/lib/auth/admin";
import { auth } from "@/lib/auth/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Admin access required",
  robots: { index: false, follow: false },
};

async function NotAdminGate() {
  await connection();
  noStore();
  const { data } = await auth.getSession();
  if (!data?.user) {
    redirect("/auth/sign-in");
  }
  if (isAdminUser(data.user)) {
    redirect("/");
  }
  return null;
}

function NotAdminBody() {
  return (
    <div
      className="flex min-h-svh flex-col items-center justify-center bg-background px-6 py-16"
      data-testid="not-admin-shell-marker"
    >
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="font-serif text-3xl tracking-tight text-foreground">
          Admin access only
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          This workspace is restricted to administrators. Your account is signed
          in, but it does not have the admin role. Contact the project owner if
          you believe this is a mistake.
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

export default function NotAdminPage() {
  return (
    <>
      <Suspense fallback={null}>
        <NotAdminGate />
      </Suspense>
      <NotAdminBody />
    </>
  );
}
