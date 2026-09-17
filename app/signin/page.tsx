import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SignInButton } from "@/components/auth/sign-in-button";
import { getSession, providers } from "@/lib/auth";

const AUTH_IMAGE =
  "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=1800&q=85";

export const metadata: Metadata = {
  title: "Sign in | Project Blue Jeans",
  description: "Sign in to your digital closet and personal styling studio.",
};

async function SignInContent() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <main
      data-testid="auth-content"
      className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,1.08fr)_minmax(28rem,0.92fr)]"
    >
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
          <Link href="/" className="font-serif text-xl tracking-tight">
            Project Blue Jeans
          </Link>
          <Link href="/" className="text-xs text-muted-foreground">
            Back home
          </Link>
        </header>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12 sm:py-16">
          <div className="page-canvas">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Private wardrobe
            </p>
            <h2 className="mt-4 font-serif text-4xl tracking-tight sm:text-5xl">
              Welcome back.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Step back into your closet and find your next look.
            </p>
            {providers.includes("google") ? (
              <SignInButton />
            ) : (
              <p role="status" className="mt-9 text-sm text-muted-foreground">
                Google sign-in is not configured for this environment.
              </p>
            )}
          </div>
        </div>
        <footer className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© Project Blue Jeans</p>
          <div className="flex gap-4">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </footer>
      </section>
    </main>
  );
}

export default function SignInPage() {
  return (
    <div data-testid="auth-shell-marker" className="min-h-svh bg-background">
      <Suspense fallback={<div className="min-h-svh bg-background" />}>
        <SignInContent />
      </Suspense>
    </div>
  );
}
