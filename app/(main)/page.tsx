import Link from "next/link";
import { Aperture, Heart, Plus, Share2 } from "lucide-react";

import { MOCK_ARCHIVE_USAGE, MOCK_MAIN_COLORS } from "@/lib/mock/dashboard";
import {
  MOCK_DASHBOARD_RECOMMENDATION,
  MOCK_OUTFIT_OF_DAY,
} from "@/lib/mock/outfits";
import { MOCK_GARMENTS } from "@/lib/mock/garments";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClothingCard } from "@/components/outfit/clothing-card";

export default function DashboardPage() {
  const recent = MOCK_GARMENTS.slice(0, 4);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12 lg:max-w-none">
      <section className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl space-y-3">
          <h1 className="font-serif text-4xl leading-tight text-foreground sm:text-5xl">
            Good morning, Julian.
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Today&apos;s light is soft and directional—favor layered neutrals
            with one deep green anchor piece.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/generator"
            className={cn(
              buttonVariants({ size: "lg" }),
              "inline-flex gap-2 rounded-full bg-gradient-to-br from-primary to-[#064e3b] text-primary-foreground shadow-[0_12px_40px_rgba(26,28,27,0.06)] hover:from-[#064e3b] hover:to-primary"
            )}
          >
            <Aperture className="size-4" />
            Generate outfit
          </Link>
          <Link
            href="/closet"
            className={cn(
              buttonVariants({ size: "lg", variant: "secondary" }),
              "inline-flex gap-2 rounded-full"
            )}
          >
            <Plus className="size-4" />
            Add clothes
          </Link>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="border-0 bg-muted/40 shadow-none">
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="relative overflow-hidden rounded-3xl bg-muted">
              <div className="aspect-[16/10] bg-gradient-to-br from-[#0d3d30] via-[#1a4d42] to-[#2a5c50]" />
              <div className="pointer-events-none absolute inset-0">
                <span className="absolute top-[18%] left-[12%] max-w-[10rem] rounded-full bg-card/95 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-wide text-foreground shadow-sm">
                  {MOCK_OUTFIT_OF_DAY.labels[0].text}
                </span>
                <span className="absolute top-[48%] right-[10%] max-w-[9rem] rounded-full bg-card/95 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-wide text-foreground shadow-sm">
                  {MOCK_OUTFIT_OF_DAY.labels[1].text}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-serif text-2xl text-foreground">
                  {MOCK_OUTFIT_OF_DAY.name}
                </h2>
                <p className="mt-2 max-w-prose text-sm text-muted-foreground">
                  {MOCK_OUTFIT_OF_DAY.summary}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon-sm" aria-label="Favorite">
                  <Heart className="size-4" />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Share">
                  <Share2 className="size-4" />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {MOCK_OUTFIT_OF_DAY.tags.map((t) => (
                <Badge
                  key={t}
                  variant="secondary"
                  className="rounded-full text-[0.65rem] font-medium uppercase tracking-wide"
                >
                  {t}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="border-0 bg-[#501e12] text-primary-foreground shadow-[0_12px_40px_rgba(26,28,27,0.08)]">
            <CardContent className="space-y-4 p-6">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white/80">
                AI style recommendation
              </p>
              <h3 className="font-serif text-xl text-white">
                {MOCK_DASHBOARD_RECOMMENDATION.title}
              </h3>
              <p className="text-sm leading-relaxed text-white/85">
                {MOCK_DASHBOARD_RECOMMENDATION.body}
              </p>
              <Button
                variant="link"
                className="h-auto p-0 text-white underline-offset-4 hover:text-white"
              >
                {MOCK_DASHBOARD_RECOMMENDATION.cta}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-0 bg-card shadow-[0_12px_40px_rgba(26,28,27,0.04)]">
            <CardContent className="space-y-6 p-6">
              <h3 className="text-sm font-semibold text-foreground">
                Closet composition
              </h3>
              <div className="space-y-2">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Main colors
                </p>
                <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                  {MOCK_MAIN_COLORS.map((c) => (
                    <div
                      key={c.label}
                      className="h-full first:rounded-l-full last:rounded-r-full"
                      style={{
                        width: `${c.value}%`,
                        backgroundColor: c.color,
                      }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Archive usage
                </p>
                <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                  {MOCK_ARCHIVE_USAGE.map((u, i) => (
                    <div
                      key={u.label}
                      className={cnBarSegment(i, MOCK_ARCHIVE_USAGE.length)}
                      style={{
                        width: `${u.value}%`,
                        backgroundColor:
                          i === 0 ? "#003527" : "var(--surface-high)",
                      }}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-serif text-2xl text-foreground">
            Recent archive additions
          </h2>
          <Link
            href="/closet"
            className={cn(
              buttonVariants({ variant: "link" }),
              "h-auto px-0 text-primary"
            )}
          >
            View archive
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {recent.map((g) => (
            <ClothingCard key={g.id} garment={g} />
          ))}
        </div>
      </section>
    </div>
  );
}

function cnBarSegment(index: number, total: number) {
  const rounded =
    index === 0
      ? "rounded-l-full"
      : index === total - 1
        ? "rounded-r-full"
        : "";
  return ["h-full", rounded].filter(Boolean).join(" ");
}
