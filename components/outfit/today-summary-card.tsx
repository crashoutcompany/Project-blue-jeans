"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { markDayWorn, wearThisFit } from "@/app/actions/today";
import { WoreThisButton } from "@/components/outfit/wore-this-button";
import { Button } from "@/components/ui/button";
import { shouldBypassImageOptimizer } from "@/lib/media/display";
import type { TodayLook, TodaySimilarDay } from "@/lib/outfits/today-data";
import { formatProductWornOn } from "@/lib/time/product-timezone";

const EYEBROW =
  "text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground";

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  return (
    <div className="relative aspect-[3/4] w-16 shrink-0 overflow-hidden rounded-lg bg-muted sm:w-20">
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          sizes="80px"
          unoptimized={shouldBypassImageOptimizer(src)}
        />
      ) : null}
    </div>
  );
}

function lookThumb(look: {
  heroImageUrl: string | null;
  garments: { imageUrl: string }[];
}): string | null {
  return look.heroImageUrl ?? look.garments[0]?.imageUrl ?? null;
}

/**
 * "Wore this" for today's Fit: commit it as today's Outfit, then confirm the
 * wear, so one tap counts toward last worn and the repeat guard.
 */
function WoreThisFitButton({
  planLookId,
  todayIso,
  onError,
}: {
  planLookId: string;
  todayIso: string;
  onError: (message: string | null) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      aria-label={`Wore this on ${formatProductWornOn(todayIso)}`}
      onClick={() => {
        onError(null);
        startTransition(async () => {
          const committed = await wearThisFit(planLookId);
          if (!committed.ok) {
            onError(committed.message);
            return;
          }
          const worn = await markDayWorn(todayIso, true);
          if (!worn.ok) onError(worn.message);
          router.refresh();
        });
      }}
    >
      {pending ? "Saving…" : "Wore this"}
    </Button>
  );
}

function lookLabel(look: TodayLook | null): string {
  if (!look) return "No look for today yet";
  if (look.title) return look.title;
  return look.kind === "outfit" ? "Outfit" : "Suggested look";
}

type ErrorSink = (message: string | null) => void;

function TodayWoreThis({
  todayIso,
  look,
  onError,
}: {
  todayIso: string;
  look: TodayLook | null;
  onError: ErrorSink;
}) {
  if (look?.kind === "outfit") {
    return (
      <WoreThisButton
        wornOn={todayIso}
        worn={look.worn ?? false}
        onError={onError}
      />
    );
  }
  if (look?.kind === "fit" && look.planLookId) {
    return (
      <WoreThisFitButton
        planLookId={look.planLookId}
        todayIso={todayIso}
        onError={onError}
      />
    );
  }
  return null;
}

function TodayLookTile({
  todayIso,
  look,
  onError,
}: {
  todayIso: string;
  look: TodayLook | null;
  onError: ErrorSink;
}) {
  return (
    <div className="flex min-w-0 gap-3" data-testid="today-summary-look">
      {look ? (
        <Thumb src={lookThumb(look)} alt={look.title ?? "Today's look"} />
      ) : null}
      <div className="flex min-w-0 flex-col items-start gap-2">
        <div className="min-w-0">
          <p className={EYEBROW}>Today&apos;s outfit</p>
          <p className="truncate text-sm text-foreground">{lookLabel(look)}</p>
        </div>
        <TodayWoreThis todayIso={todayIso} look={look} onError={onError} />
      </div>
    </div>
  );
}

function SimilarDayTile({ day }: { day: TodaySimilarDay | null }) {
  return (
    <div className="flex min-w-0 gap-3" data-testid="today-summary-similar">
      {day ? <Thumb src={lookThumb(day)} alt={day.title ?? "Outfit"} /> : null}
      <div className="min-w-0">
        <p className={EYEBROW}>Last similar day</p>
        {day ? (
          <>
            <p className="truncate text-sm text-foreground">
              {day.title ?? "Outfit"}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatProductWornOn(day.wornOn)} · {day.weather}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing worn on a day like this yet.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Top of home: today's look, today's weather, and what was worn on the last
 * day with similar weather. Sits above the Today hero; it does not replace it.
 */
export function TodaySummaryCard({
  todayIso,
  weatherLine,
  look,
  lastSimilarDay,
}: {
  todayIso: string;
  weatherLine: string;
  look: TodayLook | null;
  lastSimilarDay: TodaySimilarDay | null;
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <section
      aria-labelledby="today-summary-heading"
      data-testid="today-summary-card"
      className="flex flex-col gap-4 rounded-2xl bg-muted/40 p-4 sm:p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 id="today-summary-heading" className={EYEBROW}>
          Today
        </h2>
        <p
          className="text-sm text-foreground"
          data-testid="today-summary-weather"
        >
          {weatherLine}
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <TodayLookTile todayIso={todayIso} look={look} onError={setError} />
        <SimilarDayTile day={lastSimilarDay} />
      </div>
    </section>
  );
}
