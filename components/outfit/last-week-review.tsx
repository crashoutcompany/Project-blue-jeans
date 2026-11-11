"use client";

import Image from "next/image";
import { useState } from "react";

import { WoreThisButton } from "@/components/outfit/wore-this-button";
import { shouldBypassImageOptimizer } from "@/lib/media/display";
import type { TodayWornReviewItem } from "@/lib/outfits/today-data";
import { formatProductWornOn } from "@/lib/time/product-timezone";

/**
 * Before Plan my week: last week's Outfits, each with "Wore this", so the
 * repeat guard knows what was actually worn.
 */
export function LastWeekReview({ items }: { items: TodayWornReviewItem[] }) {
  const [error, setError] = useState<string | null>(null);
  if (items.length === 0) return null;

  return (
    <section
      className="flex flex-col gap-4 rounded-2xl bg-muted/40 p-4 sm:p-5"
      aria-labelledby="last-week-review-heading"
      data-testid="last-week-review"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="last-week-review-heading"
          className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
        >
          Last week
        </h2>
        <p className="text-sm text-muted-foreground">
          Mark what you actually wore so Plan my week doesn&apos;t repeat it.
        </p>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const src = item.heroImageUrl ?? item.garments[0]?.imageUrl ?? null;
          return (
            <li
              key={item.wornOn}
              className="flex w-28 shrink-0 flex-col gap-2 sm:w-32"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-muted">
                {src ? (
                  <Image
                    src={src}
                    alt={item.title ?? "Outfit"}
                    fill
                    className="object-cover"
                    sizes="128px"
                    unoptimized={shouldBypassImageOptimizer(src)}
                  />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground">
                  {formatProductWornOn(item.wornOn)}
                </p>
                {item.title ? (
                  <p className="truncate text-xs text-foreground">
                    {item.title}
                  </p>
                ) : null}
              </div>
              <WoreThisButton
                wornOn={item.wornOn}
                worn={item.worn}
                className="w-full"
                onError={setError}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
