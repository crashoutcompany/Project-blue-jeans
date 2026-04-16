import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { LandingFooterYear } from "./landing-footer-year";
import { LandingNavBar } from "./landing-nav-bar";

function MIcon({
  name,
  className,
  filled,
}: {
  name: string;
  className?: string;
  filled?: boolean;
}) {
  return (
    <span
      className={cn(
        "material-symbols-outlined align-middle",
        filled && "material-symbols-outlined--fill",
        className,
      )}
    >
      {name}
    </span>
  );
}

const IMG = {
  hero: "https://lh3.googleusercontent.com/aida-public/AB6AXuBD9jgCByP6MG6m590881iBbp9R0bFC8zsc6-DjLTPt-ou-ZwKnKaX-NBjL-tKvLqiRQn0Cl3xGuhOX3Qp2M6Z-Bb2bGu9pzI2ScuEXvjwQPY0GuU_kcZdC-oi1wNtjr4zzR9wq4jlJp13Bq-8UaUpgEHpE6bm91_nkahQrtw650REfo_yH-YTShVYCgITlxLRliJojNohho-uG2KTCYEBdgOJoZhJd1gyDLtNwSrRNf5nKhuJgDWN2mtiWDsFXquTtk2eZPYfm4r0",
  sanctuaryA:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCR2AV2oSEDjq8Xq2qCtft9jAj0LdiLX4wYLnux8tP1octpA_AfvrCmkUy4svY3V5yqMzowtzBunhgZChyWQeto9grgCy4HY5vhtVT9CQXyALH20dcfhjz7J0JA9dMphEusBer8Czcxgn_oIaSG30or5l-CqUmn9GGWNXz7AMM0EZ0wm7KR5jA2AFQ1PGVg-VUMSiExs6lMsvD4ffvPzyPy1bwbHgAlnoVZ0vXAHMWa98s6et9jaHDiPD3NvsXRaZYjqJc7ecUFOqs",
  sanctuaryB:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuD8rIcXanwxkKZdoZRNdc0Jf0UIQ79Ktl2-ylQUy_UhLKu76MUcGvKgXTVCgSotzatyfDf5C8QGDu1LN8atUNHvSkkrSg8Ad8215AdTskDY_B_UCaq7-Gsrv2gYbSUwkmX5f-ArBxQ8nU9wPg2pALwGjF6gavaNcokIouBkiwepxYEffeL7QTNYgY3qbAQHlLdrWtLJvicW8iYfONiQtIqQnIMBWgnOekfr-zfMbrGsukJ6wIvQ8wQWAKzpgbgL9JElNXSZGU2IE-2I",
  sanctuaryC:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAcTqKcF25Er_o_ZSzCKUa0wwS-ekRYdxBGr9aNqVM9AZOpkECtgtNGprtmHraY63E4pfGsOGVgn_a0OUW0umHdN_5a8AqV9i3duclX5pXFXbk19J-SHKCesaD8dbEB8fW5r8hOPmCiaH8MtqrKC6-8iQ8CQ9JiQkyAOu_9FiXyjGBhe-_o-C0XFzWL8ow8XRvEjITgyQEKqn94cg9FuvbLx9weOuCE5OhqP4FDPOcqcINyPeJu1pYKTJcyjs_RloVGmqIW8KNy4uc",
  sanctuaryD:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuD3p3wZ8UiTa1xKRwREeoR-0RAfBaE7sXetJcZ5RChjgYcmKDeiG6ZgDYt1SIDUVMtAXECVid5IIbwI1PYhEUl6I_1AATeY-AgeaoR5Ag75_RyIND9oo7Aqy1vZ7__mfd75ltyBleEtpVFSmFTkNubHZemlLBDGOxot5dZBrld6WRAIg11Ocz9ru8VYtKWYpofl-49Qp96LQvaRzIQg3cVoh0WqhQ1UC0swIzd1VJLpJZ_7gZnJOeQb12BkslVEqIIajTgKUgHeTxM",
  stylePortrait:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAD250PBSBwsGj4Ep2L5nKy-WkzOkgvdmpFt8TmrZe4BswKqlpEfAAHv4ahfRPiHAkbP_u7KGsKNy4Xgnwx8xk8xOHOQ20MBYshZ16T8oryVmwwBtJmEt3IIacJzuBw72rOwdnVnNF-xszqSe5vTsldVenuuRzUrlklue55GDeov90KVfB3PKrLIVD1zx7f8lGXcWwZcDQ0O8xdeWc66Li6vNMyRV5aY9HtaRlQlyZUG9lbXG_fAefmJ7kBD0DlDqrEjfrKdxA4XNo",
} as const;

function LandingImage({
  src,
  alt,
  className,
  sizes,
  priority,
}: {
  src: string;
  alt: string;
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      className={cn("object-cover", className)}
      sizes={sizes}
    />
  );
}

export function LandingPage() {
  return (
    <div className="min-h-svh bg-[#f9f9f6] text-[#1a1c1b] antialiased dark:bg-[#1a1c1b] dark:text-[#f1f1ee]">
      <LandingNavBar />

      <main className="pt-24">
        {/* Hero */}
        <section className="relative flex min-h-[min(921px,100svh)] items-center overflow-hidden px-6 sm:px-8">
          <div className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 lg:grid-cols-12">
            <div className="z-10 lg:col-span-7">
              <h1 className="mb-8 font-serif text-5xl leading-[1.1] tracking-tight text-[#003527] sm:text-7xl lg:text-8xl xl:text-9xl dark:text-[#f9f9f6]">
                Your Wardrobe,
                <br />
                <span className="italic">Reimagined</span> by Intelligence.
              </h1>
              <p className="mb-12 max-w-xl text-lg leading-relaxed text-[#695c50] sm:text-xl md:text-2xl dark:text-[#e2e3e0]">
                Upload your closet. Unlock endless possibilities. The Digital
                Atelier is your personal fashion curator, powered by AI.
              </p>
              <div className="flex flex-wrap items-center gap-6">
                <Link
                  href="/auth/sign-in"
                  className="rounded-full bg-[#003527] px-8 py-4 text-base font-semibold text-white shadow-xl shadow-[#003527]/10 transition-all hover:bg-[#064e3b] sm:px-10 sm:py-5 sm:text-lg"
                >
                  Start Your Collection
                </Link>
                <a
                  href="#showcase"
                  className="group flex items-center gap-2 px-4 py-2 text-base font-bold text-[#003527] sm:px-6 dark:text-[#f9f9f6]"
                >
                  View Showcase
                  <MIcon
                    name="arrow_forward"
                    className="text-xl transition-transform group-hover:translate-x-1"
                  />
                </a>
              </div>
            </div>
            <div className="relative lg:col-span-5">
              <div className="relative z-0 aspect-[4/5] overflow-hidden rounded-[2rem] shadow-2xl">
                <LandingImage
                  src={IMG.hero}
                  alt="High-end editorial fashion photography of a woman in a minimalist beige linen suit in a sun-drenched architectural space"
                  sizes="(max-width: 1024px) 100vw, 42vw"
                  priority
                />
              </div>
              <div className="absolute -bottom-6 -left-4 z-20 max-w-[200px] rounded-xl border border-white/50 bg-white/80 p-5 shadow-2xl backdrop-blur-md sm:-bottom-8 sm:-left-8 dark:border-white/20 dark:bg-[#1a1c1b]/80">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#003527] dark:text-[#95d3ba]">
                  Style Analysis
                </p>
                <div className="mb-4 h-1 w-full overflow-hidden rounded-full bg-[#e8e8e5] dark:bg-[#2f312f]">
                  <div className="h-full w-3/4 bg-[#003527] dark:bg-[#95d3ba]" />
                </div>
                <p className="font-serif text-sm italic text-[#1a1c1b] dark:text-[#f1f1ee]">
                  &ldquo;A balance of architectural structure and soft
                  textiles.&rdquo;
                </p>
              </div>
            </div>
          </div>
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-multiply dark:opacity-[0.06]"
            style={{
              backgroundImage:
                "url(https://www.transparenttextures.com/patterns/natural-paper.png)",
            }}
            aria-hidden
          />
        </section>

        {/* 01 Repository / Digital Sanctuary */}
        <section
          id="repository"
          className="bg-[#f4f4f1] px-6 py-24 sm:px-8 sm:py-32 dark:bg-[#2a2e2c]"
        >
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
              <div className="order-2 grid grid-cols-2 gap-4 lg:order-1">
                <div className="space-y-4 pt-0 lg:pt-12">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-2xl shadow-lg">
                    <LandingImage
                      src={IMG.sanctuaryA}
                      alt="Minimalist walk-in closet with neutral clothing on wooden racks"
                      sizes="(max-width: 1024px) 45vw, 22vw"
                    />
                  </div>
                  <div className="relative aspect-square overflow-hidden rounded-2xl shadow-lg">
                    <LandingImage
                      src={IMG.sanctuaryB}
                      alt="Silk and wool fabrics draped elegantly"
                      sizes="(max-width: 1024px) 45vw, 22vw"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="relative aspect-square overflow-hidden rounded-2xl shadow-lg">
                    <LandingImage
                      src={IMG.sanctuaryC}
                      alt="Minimalist shelves with folded cashmere and accessories"
                      sizes="(max-width: 1024px) 45vw, 22vw"
                    />
                  </div>
                  <div className="relative aspect-[3/4] overflow-hidden rounded-2xl shadow-lg">
                    <LandingImage
                      src={IMG.sanctuaryD}
                      alt="Tailored coat against a neutral stone wall"
                      sizes="(max-width: 1024px) 45vw, 22vw"
                    />
                  </div>
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <span className="mb-6 block text-sm font-semibold uppercase tracking-[0.2em] text-[#501e12]">
                  01 — The Repository
                </span>
                <h2 className="mb-8 font-serif text-4xl leading-tight tracking-tight text-[#003527] sm:text-5xl md:text-6xl dark:text-[#f9f9f6]">
                  The Digital Sanctuary
                </h2>
                <p className="mb-10 text-lg leading-relaxed text-[#695c50] sm:text-xl dark:text-[#c4c9c5]">
                  Your wardrobe deserves more than a physical space. Our
                  sanctuary captures the soul of your collection, meticulously
                  cataloging every garment with high-fidelity detail. It
                  organizes, preserves, and protects your style history, ensuring
                  your favorite pieces are never forgotten.
                </p>
                <ul className="space-y-6">
                  <li className="flex items-center gap-4">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#e2e3e0] text-[#003527] dark:bg-[#404944] dark:text-[#95d3ba]">
                      <MIcon name="inventory_2" />
                    </div>
                    <span className="text-lg font-medium text-[#1a1c1b] dark:text-[#f1f1ee]">
                      Smart Archive Management
                    </span>
                  </li>
                  <li className="flex items-center gap-4">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#e2e3e0] text-[#003527] dark:bg-[#404944] dark:text-[#95d3ba]">
                      <MIcon name="history" />
                    </div>
                    <span className="text-lg font-medium text-[#1a1c1b] dark:text-[#f1f1ee]">
                      Lifetime Style Preservation
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 02 Intelligent Curation */}
        <section
          id="showcase"
          className="bg-[#f9f9f6] px-6 py-24 sm:px-8 sm:py-32 dark:bg-[#1a1c1b]"
        >
          <div className="mx-auto max-w-7xl">
            <div id="vision" className="mx-auto mb-24 max-w-3xl text-center">
              <span className="mb-6 block text-sm font-semibold uppercase tracking-[0.2em] text-[#501e12]">
                02 — The Algorithm
              </span>
              <h2 className="mb-8 font-serif text-4xl tracking-tight text-[#003527] sm:text-6xl md:text-7xl dark:text-[#f9f9f6]">
                Intelligent Curation
              </h2>
              <p className="text-lg leading-relaxed text-[#695c50] sm:text-xl dark:text-[#c4c9c5]">
                Beyond simple matching, our AI understands the nuance of
                context. It considers the local atmosphere, the gravity of your
                occasion, and the unique signature of your Style DNA to
                generate the perfect ensemble.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <div className="flex flex-col gap-8 rounded-[2rem] bg-[#f4f4f1] p-8 transition-transform duration-500 hover:-translate-y-2 sm:p-10 dark:bg-[#2a2e2c]">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-[#003527] text-white">
                  <MIcon name="thermostat" className="text-3xl" />
                </div>
                <h3 className="font-serif text-2xl text-[#003527] sm:text-3xl dark:text-[#f9f9f6]">
                  Atmospheric Context
                </h3>
                <p className="leading-relaxed text-[#695c50] dark:text-[#c4c9c5]">
                  Real-time weather integration ensures your curated look is as
                  functional as it is aesthetic, adapting to humidity and
                  temperature.
                </p>
              </div>
              <div className="flex flex-col gap-8 rounded-[2rem] border border-black/[0.04] bg-white p-8 shadow-xl shadow-black/[0.02] transition-transform duration-500 hover:-translate-y-2 sm:p-10 dark:border-white/10 dark:bg-[#232625]">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-[#501e12] text-white">
                  <MIcon name="event_note" className="text-3xl" />
                </div>
                <h3 className="font-serif text-2xl text-[#003527] sm:text-3xl dark:text-[#f9f9f6]">
                  Occasion Logic
                </h3>
                <p className="leading-relaxed text-[#695c50] dark:text-[#c4c9c5]">
                  From boardrooms to galas, the AI deciphers dress codes and
                  cultural nuances to suggest appropriate silhouette and tone.
                </p>
              </div>
              <div className="flex flex-col gap-8 rounded-[2rem] bg-[#f4f4f1] p-8 transition-transform duration-500 hover:-translate-y-2 sm:p-10 dark:bg-[#2a2e2c]">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-[#064e3b] text-[#80bea6]">
                  <MIcon name="genetics" className="text-3xl" />
                </div>
                <h3 className="font-serif text-2xl text-[#003527] sm:text-3xl dark:text-[#f9f9f6]">
                  Style DNA Matching
                </h3>
                <p className="leading-relaxed text-[#695c50] dark:text-[#c4c9c5]">
                  The generator learns your proportions, color preferences, and
                  favored textures to ensure every output feels authentically
                  you.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 03 Style DNA */}
        <section className="overflow-hidden px-6 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-7xl">
            <div className="relative grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
              <div className="order-2 lg:order-1 lg:col-span-5">
                <div className="relative mx-auto max-w-md lg:mx-0">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-full border-[12px] border-[#f4f4f1] dark:border-[#2a2e2c]">
                    <LandingImage
                      src={IMG.stylePortrait}
                      alt="Stylish individual in a dark emerald coat against a soft grey background"
                      sizes="(max-width: 1024px) 90vw, 40vw"
                    />
                  </div>
                  <div className="relative z-10 mx-auto mt-8 w-full max-w-[280px] rounded-3xl border border-white/40 bg-white/70 p-6 shadow-2xl backdrop-blur-2xl sm:p-8 lg:absolute lg:top-1/2 lg:right-0 lg:mx-0 lg:mt-0 lg:-translate-y-1/2 lg:translate-x-4 xl:-right-12 xl:translate-x-0 dark:border-white/20 dark:bg-[#1a1c1b]/70">
                    <div className="mb-6 flex items-center gap-3">
                      <MIcon
                        name="auto_awesome"
                        className="text-2xl text-[#501e12] dark:text-[#ffdad2]"
                        filled
                      />
                      <span className="text-sm font-bold uppercase tracking-widest text-[#003527] dark:text-[#95d3ba]">
                        Profile Analysis
                      </span>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#695c50] dark:text-[#c4c9c5]">
                          Palette Harmony
                        </span>
                        <span className="font-bold text-[#003527] dark:text-[#f9f9f6]">
                          98%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#e8e8e5] dark:bg-[#404944]">
                        <div className="h-full w-[98%] bg-[#501e12] dark:bg-[#ffdad2]" />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#695c50] dark:text-[#c4c9c5]">
                          Textural Preference
                        </span>
                        <span className="font-bold text-[#003527] dark:text-[#f9f9f6]">
                          Silks &amp; Wool
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="order-1 lg:order-2 lg:col-span-6 lg:col-start-7">
                <span className="mb-6 block text-sm font-semibold uppercase tracking-[0.2em] text-[#501e12]">
                  03 — Identity
                </span>
                <h2 className="mb-8 font-serif text-4xl leading-tight tracking-tight text-[#003527] sm:text-5xl md:text-6xl dark:text-[#f9f9f6]">
                  The Style DNA Profile
                </h2>
                <p className="mb-12 text-lg leading-relaxed text-[#695c50] sm:text-xl dark:text-[#c4c9c5]">
                  Every user is a unique collection of preferences and
                  physiological traits. Your Style DNA profile acts as a living
                  blueprint, evolving as you interact with the world and your
                  wardrobe. It&apos;s more than a settings page—it&apos;s your
                  digital twin in the world of high fashion.
                </p>
                <Link
                  href="/auth/sign-in"
                  className="group inline-flex items-center gap-3 border-b-2 border-[#003527] pb-1 text-lg font-bold text-[#003527] transition-colors hover:border-[#501e12] hover:text-[#501e12] dark:border-[#95d3ba] dark:text-[#95d3ba] dark:hover:border-[#ffdad2] dark:hover:text-[#ffdad2]"
                >
                  Explore the DNA Logic
                  <MIcon
                    name="north_east"
                    className="text-xl transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-[#003527] px-6 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-5xl text-center">
            <h2 className="mb-12 font-serif text-4xl italic leading-tight text-white sm:text-6xl md:text-7xl">
              Step into the Atelier.
            </h2>
            <div className="flex flex-col items-center justify-center gap-6 md:flex-row">
              <Link
                href="/auth/sign-in"
                className="w-full rounded-full bg-white px-10 py-5 text-lg font-bold text-[#003527] transition-all hover:bg-[#f9f9f6] md:w-auto md:px-12 md:py-6 md:text-xl"
              >
                Begin Your Journey
              </Link>
              <a
                href="mailto:hello@thedigitalatelier.com"
                className="w-full rounded-full border border-white/30 px-10 py-5 text-lg font-bold text-white transition-colors hover:bg-white/10 md:w-auto md:px-12 md:py-6 md:text-xl"
              >
                Inquire for Enterprise
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full bg-[#f4f4f1] px-6 py-12 sm:px-8 dark:bg-[#121212]">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-8 md:flex-row">
          <div className="flex flex-col items-center gap-2 md:items-start">
            <div className="font-serif text-lg text-[#003527] dark:text-[#f9f9f6]">
              The Digital Atelier
            </div>
            <p className="text-center text-sm tracking-wide text-[#695c50] md:text-left dark:text-[#e2e3e0]">
              © <LandingFooterYear /> The Digital Atelier. All rights reserved.
            </p>
          </div>
          <div className="flex gap-10">
            <Link
              href="/privacy"
              className="text-sm tracking-wide text-[#695c50] transition-colors duration-200 hover:text-[#501e12] dark:text-[#e2e3e0] dark:hover:text-[#ffdad2]"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-sm tracking-wide text-[#695c50] transition-colors duration-200 hover:text-[#501e12] dark:text-[#e2e3e0] dark:hover:text-[#ffdad2]"
            >
              Terms
            </Link>
            <a
              href="mailto:hello@thedigitalatelier.com"
              className="text-sm tracking-wide text-[#695c50] transition-colors duration-200 hover:text-[#501e12] dark:text-[#e2e3e0] dark:hover:text-[#ffdad2]"
            >
              Contact
            </a>
          </div>
          <div className="flex gap-6 text-[#695c50] dark:text-[#e2e3e0]">
            <a
              href="#"
              className="transition-colors hover:text-[#003527] dark:hover:text-[#f9f9f6]"
              aria-label="Website"
            >
              <MIcon name="public" />
            </a>
            <a
              href="#"
              className="transition-colors hover:text-[#003527] dark:hover:text-[#f9f9f6]"
              aria-label="Brand"
            >
              <MIcon name="brand_awareness" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
