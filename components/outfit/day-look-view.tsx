"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import {
  planMyWeek,
  unwearDayForUser,
  wearThisFit,
} from "@/app/actions/today";
import type { ClothingCardData } from "@/lib/garments/types";
import { shouldBypassImageOptimizer } from "@/lib/media/display";
import type { TodayPageData } from "@/lib/outfits/today-data";
import { formatProductDateLong } from "@/lib/time/product-timezone";
import { cn } from "@/lib/utils";
import { GeneratorSheet } from "@/components/outfit/generator-sheet";
import { Button, buttonVariants } from "@/components/ui/button";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const PRESS =
  "active:scale-[0.97] transition-transform duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transform-none";

function initialSelectedDay(
  data: TodayPageData,
  dayParam: string | null,
): string {
  if (
    dayParam &&
    ISO_DAY.test(dayParam) &&
    data.weekPeek.some((d) => d.wornOn === dayParam)
  ) {
    return dayParam;
  }
  return data.todayIso;
}

export function DayLookView({
  data,
  closetGarments,
}: {
  data: TodayPageData;
  closetGarments: ClothingCardData[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const changeLookFromUrl = searchParams.get("change-look") === "1";
  const dayFromUrl = searchParams.get("day");
  const [selectedWornOn, setSelectedWornOn] = useState(() =>
    initialSelectedDay(data, dayFromUrl),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [manualChangeLookOpen, setManualChangeLookOpen] = useState(false);

  const look =
    data.weekLooks[selectedWornOn] ??
    (selectedWornOn === data.todayIso ? data.look : null);
  const canEdit = selectedWornOn >= data.todayIso;
  const changeLookOpen =
    canEdit && (changeLookFromUrl || manualChangeLookOpen);
  const isTodaySelected = selectedWornOn === data.todayIso;

  function setChangeLookOpen(open: boolean) {
    if (open) {
      if (!canEdit) return;
      setManualChangeLookOpen(true);
      return;
    }
    setManualChangeLookOpen(false);
    if (changeLookFromUrl) {
      router.replace("/");
    }
  }

  if (data.garmentCount === 0) {
    return (
      <>
        <div className="page-canvas mx-auto flex min-h-[70svh] max-w-lg flex-col justify-center gap-5">
          <h1 className="font-serif text-3xl tracking-tight text-foreground">
            Your closet is empty
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Add clothes to your closet to get started.
          </p>
          <Link
            href="/closet"
            className={cn(buttonVariants({ size: "lg" }), "w-fit", PRESS)}
          >
            Add clothes
          </Link>
        </div>
        <GeneratorSheet
          open={changeLookOpen}
          onOpenChange={setChangeLookOpen}
          closetGarments={closetGarments}
          wornOn={data.todayIso}
          onApproved={() => router.refresh()}
        />
      </>
    );
  }

  const collage =
    look && !look.heroImageUrl && look.garments.length > 0
      ? look.garments.slice(0, 4)
      : null;
  const dateHeading = formatProductDateLong(selectedWornOn);

  return (
    <div className="page-canvas mx-auto flex w-full max-w-3xl flex-col gap-12 pb-16">
      {look ? (
        <div className="flex flex-col gap-5">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {dateHeading}
          </p>

          <section className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-muted">
            {look.heroImageUrl ? (
              <Image
                key={look.heroImageUrl}
                src={look.heroImageUrl}
                alt={look.title ?? "Look for this day"}
                fill
                priority
                unoptimized={look.heroImageUrl.startsWith("data:")}
                className="object-cover transition-opacity duration-220 ease-[cubic-bezier(0.23,1,0.32,1)]"
                sizes="(max-width: 768px) 100vw, 48rem"
              />
            ) : collage ? (
              <div className="grid h-full w-full grid-cols-2 grid-rows-2">
                {collage.map((g) => (
                  <div key={g.id} className="relative">
                    <Image
                      src={g.imageUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="25vw"
                      unoptimized={shouldBypassImageOptimizer(g.imageUrl)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Look brewing…
              </div>
            )}
            {look.title ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background from-10% via-background/75 to-transparent px-5 pb-5 pt-24">
                <h1 className="font-serif text-3xl leading-[1.15] tracking-tight text-foreground sm:text-4xl">
                  {look.title}
                </h1>
              </div>
            ) : null}
          </section>

          <div className="flex flex-col gap-3">
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            {canEdit ? (
              <div className="flex flex-wrap items-center gap-2">
                {look.kind === "fit" && look.planLookId ? (
                  <Button
                    size="lg"
                    disabled={pending}
                    className={PRESS}
                    onClick={() => {
                      setError(null);
                      startTransition(async () => {
                        const res = await wearThisFit(look.planLookId!);
                        if (!res.ok) {
                          setError(res.message);
                          return;
                        }
                        router.refresh();
                      });
                    }}
                  >
                    {pending ? "Saving…" : "Wear this"}
                  </Button>
                ) : null}

                <Button
                  variant={look.kind === "outfit" ? "default" : "outline"}
                  size="lg"
                  className={PRESS}
                  onClick={() => setChangeLookOpen(true)}
                >
                  Change look
                </Button>

                {look.kind === "outfit" ? (
                  <Button
                    variant="ghost"
                    size="lg"
                    disabled={pending}
                    className={PRESS}
                    onClick={() => {
                      setError(null);
                      startTransition(async () => {
                        const res = await unwearDayForUser(selectedWornOn);
                        if (!res.ok) {
                          setError(res.message);
                          return;
                        }
                        setSelectedWornOn(data.todayIso);
                        router.refresh();
                      });
                    }}
                  >
                    Unwear
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Past look — view only.
              </p>
            )}

            {!data.hasWearerPhoto ? (
              <p className="text-sm text-muted-foreground">
                Add a photo of you for try-on looks.{" "}
                <Link
                  href="/settings"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Add wearer photo
                </Link>
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex min-h-[36svh] flex-col justify-center gap-5 py-6">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {dateHeading}
          </p>
          <h1 className="font-serif text-3xl tracking-tight text-foreground">
            {isTodaySelected
              ? "No look for today yet."
              : "No look for this day yet."}
          </h1>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {isTodaySelected ? (
            <Button
              size="lg"
              disabled={pending}
              className={cn("w-fit", PRESS)}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const res = await planMyWeek();
                  if (!res.ok) {
                    setError(res.message);
                    return;
                  }
                  router.refresh();
                });
              }}
            >
              {pending ? "Planning…" : "Plan my week"}
            </Button>
          ) : canEdit ? (
            <Button
              size="lg"
              className={cn("w-fit", PRESS)}
              onClick={() => setChangeLookOpen(true)}
            >
              Change look
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Past look — view only.
            </p>
          )}
        </div>
      )}

      {look && look.garments.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            The pieces
          </h2>
          <ul className="flex gap-4 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {look.garments.map((g) => (
              <li key={g.id} className="shrink-0">
                <Link
                  href="/closet"
                  className="block w-28 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-32"
                >
                  <div className="garment-tile relative aspect-[0.78] w-28 overflow-hidden rounded-xl bg-muted sm:w-32">
                    <Image
                      src={g.imageUrl}
                      alt={g.name ?? g.category}
                      fill
                      data-garment-image
                      className="object-cover"
                      sizes="128px"
                      unoptimized={shouldBypassImageOptimizer(g.imageUrl)}
                    />
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-snug text-muted-foreground">
                    {g.name ?? g.category}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-4" aria-label="This week">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          This week
        </h2>
        <ul className="grid grid-cols-7 gap-2 sm:gap-3">
          {data.weekPeek.map((day) => {
            const isToday = day.wornOn === data.todayIso;
            const isSelected = day.wornOn === selectedWornOn;
            const hasLook = day.kind !== "empty";
            return (
              <li key={day.wornOn} className="flex flex-col items-center gap-2">
                <span
                  className={cn(
                    "flex items-center gap-1 text-[0.65rem] uppercase tracking-wider",
                    isSelected || isToday
                      ? "text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {isToday ? (
                    <span
                      className="size-1 rounded-full bg-foreground"
                      aria-hidden
                    />
                  ) : null}
                  {day.label}
                </span>
                <button
                  type="button"
                  aria-label={`Show look for ${formatProductDateLong(day.wornOn)}`}
                  aria-current={isSelected ? "true" : undefined}
                  onClick={() => setSelectedWornOn(day.wornOn)}
                  className={cn(
                    "relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-muted",
                    "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "transition-[transform,opacity] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)]",
                    "active:scale-[0.97] motion-reduce:transform-none",
                    isSelected ? "opacity-100" : "opacity-40",
                  )}
                >
                  {day.heroImageUrl ? (
                    <Image
                      src={day.heroImageUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  ) : (
                    <span className="sr-only">
                      {hasLook ? day.kind : "empty"}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <GeneratorSheet
        open={changeLookOpen}
        onOpenChange={setChangeLookOpen}
        closetGarments={closetGarments}
        wornOn={selectedWornOn}
        onApproved={() => router.refresh()}
      />
    </div>
  );
}
