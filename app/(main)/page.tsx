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
    <div className="mx-auto flex max-w-6xl flex-col gap-12 lg:max-w-none">
      <section className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl space-y-3">
          <h1 className="font-serif text-4xl leading-tight text-foreground sm:text-5xl">
            Overview
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Jump into the generator with your closet, or add pieces you want
            styled.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/generator"
            className={cn(
              buttonVariants({ size: "lg" }),
              "inline-flex gap-2 rounded-full bg-gradient-to-br from-primary to-[#064e3b] text-primary-foreground shadow-[0_12px_40px_rgba(26,28,27,0.06)] hover:from-[#064e3b] hover:to-primary",
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

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="border-0 bg-muted/40 shadow-none">
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="relative overflow-hidden rounded-3xl border border-dashed border-border bg-muted/60">
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

        <div className="flex flex-col gap-6">
          <Card className="border-0 bg-[#501e12] text-primary-foreground shadow-[0_12px_40px_rgba(26,28,27,0.08)]">
            <CardContent className="space-y-4 p-6">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white/80">
                AI style recommendation
              </p>
              <p className="text-sm leading-relaxed text-white/85">
                Recommendations appear after you generate looks from your closet.
              </p>
              <Link
                href="/generator"
                className={cn(
                  buttonVariants({ variant: "link" }),
                  "h-auto p-0 text-white underline-offset-4 hover:text-white",
                )}
              >
                Go to generator
              </Link>
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
          <h2 className="font-serif text-2xl text-foreground">
            Recent archive additions
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
