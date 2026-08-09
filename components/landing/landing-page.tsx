import Image from "next/image";
import Link from "next/link";

import { LandingFooterYear } from "./landing-footer-year";
import { LandingNavBar } from "./landing-nav-bar";

const HERO_IMG =
  "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=2400&q=80";
const PROOF_IMG =
  "https://images.unsplash.com/photo-1558171813-4c088753af8f?auto=format&fit=crop&w=1600&q=80";

export function LandingPage() {
  return (
    <div className="min-h-svh bg-[#1a1814] text-[#f4f0e8]">
      <LandingNavBar />

      <main>
        <section className="relative min-h-svh w-full">
          <Image
            src={HERO_IMG}
            alt=""
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1814] via-[#1a1814]/55 to-[#1a1814]/25" />
          <div className="relative z-10 flex min-h-svh flex-col justify-end px-6 pb-16 pt-28 sm:px-10 sm:pb-24 lg:px-16">
            <div className="page-canvas max-w-xl">
              <p className="font-serif text-5xl tracking-tight text-[#f4f0e8] sm:text-6xl lg:text-7xl">
                Project Blue Jeans
              </p>
              <p className="mt-5 max-w-md text-base leading-relaxed text-[#f4f0e8]/85 sm:text-lg">
                Decide what to wear today — from clothes you already own.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/auth/sign-in"
                  className="inline-flex h-12 items-center bg-[#f4f0e8] px-8 text-sm font-medium tracking-wide text-[#1a1814] transition-colors duration-200 hover:bg-white"
                >
                  Get started
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-20 sm:px-10 sm:py-28">
          <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">
            How it works
          </h2>
          <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {[
              {
                step: "01",
                title: "Add clothes",
                body: "Photograph pieces into your closet. That’s the inventory.",
              },
              {
                step: "02",
                title: "Plan my week",
                body: "Get Fits for the rest of this week — starting with today.",
              },
              {
                step: "03",
                title: "Wear this",
                body: "Commit today’s look. Change it anytime from Today.",
              },
            ].map((item) => (
              <li key={item.step} className="flex flex-col gap-3">
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#f4f0e8]/45">
                  {item.step}
                </span>
                <h3 className="font-serif text-xl">{item.title}</h3>
                <p className="text-sm leading-relaxed text-[#f4f0e8]/70">
                  {item.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="relative min-h-[50svh] w-full">
          <Image
            src={PROOF_IMG}
            alt=""
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[#1a1814]/45" />
          <div className="relative z-10 flex min-h-[50svh] items-end px-6 py-16 sm:px-10 lg:px-16">
            <p className="max-w-md font-serif text-2xl leading-snug text-[#f4f0e8] sm:text-3xl">
              Built around the clothes hanging in your closet — not a shopping
              feed.
            </p>
          </div>
        </section>

        <section className="px-6 py-24 text-center sm:px-10 sm:py-32">
          <p className="font-serif text-3xl tracking-tight sm:text-4xl">
            Ready for today?
          </p>
          <Link
            href="/auth/sign-in"
            className="mt-8 inline-flex h-12 items-center bg-[#f4f0e8] px-8 text-sm font-medium tracking-wide text-[#1a1814] transition-colors duration-200 hover:bg-white"
          >
            Sign in
          </Link>
        </section>
      </main>

      <footer className="border-t border-white/10 px-6 py-10 text-center sm:px-10">
        <p className="font-serif text-lg">Project Blue Jeans</p>
        <p className="mt-2 text-xs text-[#f4f0e8]/50">
          © <LandingFooterYear /> ·{" "}
          <Link href="/privacy" className="underline-offset-2 hover:underline">
            Privacy
          </Link>{" "}
          ·{" "}
          <Link href="/terms" className="underline-offset-2 hover:underline">
            Terms
          </Link>
        </p>
      </footer>
    </div>
  );
}
