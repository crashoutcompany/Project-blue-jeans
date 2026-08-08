import Link from "next/link";
import { Aperture, Plus } from "lucide-react";

import { getClosetGarmentsCached } from "@/lib/garments/get-closet-garments-cached";
import type { ClothingCardData } from "@/lib/garments/types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ClothingCard } from "@/components/outfit/clothing-card";

function mainColorSegments(garments: ClothingCardData[]) {
  if (garments.length === 0) return [];
  const counts = new Map<string, number>();
  for (const g of garments) {
    const hex =
      g.colorHex?.startsWith("#") ? g.colorHex.toLowerCase() : "#cbd5e1";
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const total = garments.length;
  return sorted.map(([color, n]) => ({
    color,
    value: Math.round((100 * n) / total),
    label: color,
  }));
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

export default async function DashboardPage() {
  const garments = await getClosetGarmentsCached();
  const recent = garments.slice(0, 4);
  const colorSegments = mainColorSegments(garments);

  return (
    <div className="page-canvas flex min-w-0 flex-col gap-9">
      <section className="flex flex-col gap-5 border-b border-foreground/8 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Personal collection
          </p>
          <h1 className="mt-1.5 text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
            Your wardrobe, reimagined
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Build new combinations from the pieces you already own.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/generator"
            className={cn(
              buttonVariants({ size: "lg" }),
              "inline-flex gap-2 rounded-full bg-foreground text-background hover:bg-foreground/85",
            )}
          >
            <Aperture className="size-4" />
            Generate outfit
          </Link>
          <Link
            href="/closet"
            className={cn(
              buttonVariants({ size: "lg", variant: "secondary" }),
              "inline-flex gap-2 rounded-full",
            )}
          >
            <Plus className="size-4" />
            Add clothes
          </Link>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]">
        <Card className="rounded-2xl bg-foreground/[0.025] py-0 ring-0">
          <CardContent className="space-y-6 p-5 sm:p-6">
            <div className="relative overflow-hidden rounded-xl border border-dashed border-foreground/12 bg-background/60">
              <div className="flex aspect-[16/10] flex-col items-center justify-center gap-2 px-6 text-center">
                <p className="font-serif text-lg text-foreground">
                  No spotlight look yet
                </p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Generate a lookbook to pin a hero outfit here.
                </p>
                <Link
                  href="/generator"
                  className={cn(
                    buttonVariants({ variant: "secondary" }),
                    "mt-2 rounded-full",
                  )}
                >
                  Open generator
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-5">
          <Card className="rounded-2xl border border-foreground/10 bg-transparent py-0 ring-0">
            <CardContent className="flex flex-col gap-5 p-6">
              <div className="space-y-2">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  AI style recommendation
                </p>
                <p className="text-sm leading-relaxed text-foreground">
                  Recommendations appear after you generate looks from your
                  closet.
                </p>
              </div>
              <Link
                href="/generator"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "w-fit rounded-full bg-foreground text-background hover:bg-foreground/90",
                )}
              >
                Go to generator
              </Link>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-foreground/[0.04] ring-0">
            <CardContent className="space-y-6 p-6">
              <h3 className="text-sm font-semibold text-foreground">
                Closet composition
              </h3>
              <div className="space-y-2">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Main colors
                </p>
                {colorSegments.length > 0 ? (
                  <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                    {colorSegments.map((c, i) => (
                      <div
                        key={c.label}
                        className={cnBarSegment(i, colorSegments.length)}
                        style={{
                          width: `${c.value}%`,
                          backgroundColor: c.color,
                        }}
                        title={c.label}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Add pieces with colors in your closet to see a breakdown.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Wear history
                </p>
                <p className="text-sm text-muted-foreground">
                  Not tracked yet—archive usage will show here when available.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-xl font-medium tracking-tight text-foreground">
            Recently added
          </h2>
          <Link
            href="/closet"
            className={cn(
              buttonVariants({ variant: "link" }),
              "h-auto px-0 text-primary",
            )}
          >
            View archive
          </Link>
        </div>
        {recent.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((g) => (
              <ClothingCard key={g.id} garment={g} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
            Your closet is empty.{" "}
            <Link
              href="/closet"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Add garments
            </Link>{" "}
            to see them here.
          </p>
        )}
      </section>
    </div>
  );
}
