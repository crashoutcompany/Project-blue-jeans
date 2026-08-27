import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { AuthView } from "@neondatabase/auth/react";

import { RedirectWhenSignedIn } from "@/components/auth/redirect-when-signed-in";

const AUTH_IMAGE =
  "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=1800&q=85";

export const metadata: Metadata = {
  title: "Sign in | Project Blue Jeans",
  description: "Sign in to your digital closet and personal styling studio.",
};

async function AuthPageContent({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;
  const isSignIn = path === "sign-in";

  return (
    <main
      data-testid="auth-content"
      className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,1.08fr)_minmax(28rem,0.92fr)]"
    >
      <RedirectWhenSignedIn path={path} />

      <section className="relative hidden min-h-svh overflow-hidden bg-[#1a1814] text-[#f4f0e8] lg:flex lg:flex-col lg:justify-between">
        <Image
          src={AUTH_IMAGE}
          alt=""
          fill
          priority
          className="object-cover"
          sizes="(min-width: 1024px) 54vw, 0px"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1814]/35 via-[#1a1814]/20 to-[#1a1814]/90" />

        <Link
          href="/"
          className="relative m-10 w-fit font-serif text-2xl tracking-tight text-[#f4f0e8] outline-offset-8 transition-opacity hover:opacity-80 xl:m-14"
        >
          Project Blue Jeans
        </Link>

        <div className="page-canvas relative max-w-xl p-10 xl:p-14">
          <p className="mb-5 text-xs font-medium uppercase tracking-[0.24em] text-[#f4f0e8]/65">
            Your digital atelier
          </p>
          <h1 className="font-serif text-5xl leading-[1.04] tracking-tight xl:text-6xl">
            Your wardrobe,
            <br />
            considered.
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-[#f4f0e8]/75">
            A quieter way to get dressed. Build looks from the pieces you
            already own, plan your week, and make every garment count.
          </p>
        </div>
      </section>

      <section className="relative flex min-h-svh flex-col px-6 py-6 sm:px-10 sm:py-8 lg:px-14 xl:px-20">
        <header className="flex items-center justify-between lg:hidden">
          <Link
            href="/"
            className="font-serif text-xl tracking-tight text-foreground"
          >
            Project Blue Jeans
          </Link>
          <Link
            href="/"
            className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Back home
          </Link>
        </header>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12 sm:py-16">
          <div className="page-canvas">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              {isSignIn ? "Private wardrobe" : "Account access"}
            </p>
            <h2 className="mt-4 font-serif text-4xl tracking-tight text-foreground sm:text-5xl">
              {isSignIn ? "Welcome back." : "Your account."}
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {isSignIn
                ? "Step back into your closet and find your next look."
                : "Continue securely to manage your digital closet."}
            </p>

            <AuthView
              path={path}
              redirectTo="/"
              className="mt-9 max-w-none border-0 bg-transparent p-0 shadow-none"
              classNames={{
                header: "px-0 pt-0",
                title: "font-serif text-2xl tracking-tight",
                description: "leading-relaxed",
                content: "px-0",
                footer: "px-0 pb-0",
              }}
            />
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© Project Blue Jeans</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
          </div>
        </footer>
      </section>
    </main>
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
          <div className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,1.08fr)_minmax(28rem,0.92fr)]">
            <div className="hidden bg-[#1a1814] lg:block" />
            <div className="flex items-center justify-center px-6 text-sm text-muted-foreground">
              Preparing your wardrobe…
            </div>
          </div>
        }
      >
        <AuthPageContent params={params} />
      </Suspense>
    </div>
  );
}
