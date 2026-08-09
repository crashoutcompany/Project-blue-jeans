"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  planMyWeek,
  unwearToday,
  wearThisFit,
} from "@/app/actions/today";
import type { ClothingCardData } from "@/lib/garments/types";
import type { TodayPageData } from "@/lib/outfits/today-data";
import { cn } from "@/lib/utils";
import { GeneratorSheet } from "@/components/outfit/generator-sheet";
import { Button } from "@/components/ui/button";

export function TodayView({
  data,
  closetGarments,
  initialChangeLookOpen = false,
}: {
  data: TodayPageData;
  closetGarments: ClothingCardData[];
  initialChangeLookOpen?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [changeLookOpen, setChangeLookOpen] = useState(initialChangeLookOpen);

  if (data.garmentCount === 0) {
    return (
      <div className="page-canvas mx-auto flex min-h-[70svh] max-w-lg flex-col items-center justify-center gap-6 px-4 text-center">
        <p className="text-muted-foreground">
          Add clothes to your closet to get started.
        </p>
        <Button
          render={<Link href="/closet" />}
          nativeButton={false}
          size="lg"
        >
          Add clothes
        </Button>
      </div>
    );
  }

  if (!data.look) {
    return (
      <>
        <div className="page-canvas mx-auto flex min-h-[70svh] max-w-lg flex-col items-center justify-center gap-6 px-4 text-center">
          <p className="text-muted-foreground">No look for today yet.</p>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            size="lg"
            disabled={pending}
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

  const { look } = data;
  const collage =
    !look.heroImageUrl && look.garments.length > 0
      ? look.garments.slice(0, 4)
      : null;

  return (
    <div className="page-canvas mx-auto flex max-w-3xl flex-col gap-8 px-4 pb-16 pt-2 sm:px-6">
      <section className="relative aspect-[3/4] w-full overflow-hidden bg-muted sm:aspect-[4/5]">
        {look.heroImageUrl ? (
          <Image
            src={look.heroImageUrl}
            alt=""
            fill
            priority
            unoptimized={look.heroImageUrl.startsWith("data:")}
            className="object-cover transition-opacity duration-220 ease-[cubic-bezier(0.2,0.7,0.2,1)]"
            sizes="(max-width: 768px) 100vw, 48rem"
          />
        ) : collage ? (
          <div className="grid h-full w-full grid-cols-2 grid-rows-2">
            {collage.map((g) => (
              <div key={g.id} className="relative border border-background/40">
                <Image
                  src={g.imageUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="25vw"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Look brewing…
          </div>
        )}
      </section>

      <div className="flex flex-col gap-4">
        {look.title ? (
          <h1 className="font-serif text-2xl tracking-tight text-foreground sm:text-3xl">
            {look.title}
          </h1>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {look.kind === "fit" && look.planLookId ? (
            <Button
              size="lg"
              disabled={pending}
              className="active:scale-[0.97] transition-transform duration-160 ease-out"
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
            onClick={() => setChangeLookOpen(true)}
          >
            Change look
          </Button>

          {look.kind === "outfit" ? (
            <Button
              variant="ghost"
              size="lg"
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const res = await unwearToday();
                  if (!res.ok) {
                    setError(res.message);
                    return;
                  }
                  router.refresh();
                });
              }}
            >
              Unwear
            </Button>
          ) : null}
        </div>

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

      {look.garments.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Garments used
          </h2>
          <ul className="flex gap-3 overflow-x-auto pb-1">
            {look.garments.map((g) => (
              <li key={g.id} className="shrink-0">
                <Link
                  href="/closet"
                  className="block w-20 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="relative aspect-[0.78] w-20 overflow-hidden bg-muted">
                    <Image
                      src={g.imageUrl}
                      alt={g.name ?? g.category}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {g.name ?? g.category}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-3" aria-label="This week">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          This week
        </h2>
        <ul className="grid grid-cols-7 gap-2">
          {data.weekPeek.map((day) => {
            const isToday = day.wornOn === data.todayIso;
            return (
              <li
                key={day.wornOn}
                className={cn(
                  "flex flex-col items-center gap-1.5",
                  isToday && "font-medium",
                )}
              >
                <span className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                  {day.label}
                </span>
                <div
                  className={cn(
                    "relative aspect-square w-full overflow-hidden bg-muted",
                    isToday && "ring-1 ring-foreground",
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
                    <span className="sr-only">{day.kind}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <GeneratorSheet
        open={changeLookOpen}
        onOpenChange={setChangeLookOpen}
        closetGarments={closetGarments}
        wornOn={data.todayIso}
        onApproved={() => router.refresh()}
      />
    </div>
  );
}
