"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";

import { approveWeeklyPlanLook } from "@/app/actions/outfits";
import type {
  CalendarLookThumb,
  CalendarSavedOutfit,
  CalendarWeeklyLook,
} from "@/lib/outfits/calendar-data";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  formatProductMonthYear,
  productTodayIso,
} from "@/lib/time/product-timezone";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;

const CELL_ASPECT = "aspect-[3/4]";

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function monthHref(y: number, m: number) {
  return `/calendar?year=${y}&month=${m}`;
}

function padGridStartMonday(year: number, month: number): number {
  const dow = new Date(year, month - 1, 1).getDay();
  return (dow + 6) % 7;
}

function buildMonthCells(year: number, month: number) {
  const pad = padGridStartMonday(year, month);
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: ({ type: "empty" } | { type: "day"; day: number })[] = [];
  for (let i = 0; i < pad; i++) cells.push({ type: "empty" });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ type: "day", day: d });
  while (cells.length % 7 !== 0) cells.push({ type: "empty" });
  while (cells.length < 42) cells.push({ type: "empty" });
  return cells;
}

function isoDay(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function DayLookMedia({
  heroUrl,
  thumbs,
}: {
  heroUrl: string | null;
  thumbs: CalendarLookThumb[];
}) {
  if (heroUrl) {
    return (
      <Image
        src={heroUrl}
        alt=""
        fill
        className="object-cover"
        sizes="(max-width: 640px) 28vw, (max-width: 1024px) 14vw, 12vw"
        unoptimized={heroUrl.startsWith("data:") ? true : undefined}
      />
    );
  }

  if (thumbs.length === 0) return null;

  const slice = thumbs.slice(0, 4);
  const cols = slice.length === 1 ? "grid-cols-1" : "grid-cols-2";
  const rows = slice.length <= 2 ? "grid-rows-1" : "grid-rows-2";

  return (
    <div className={cn("grid size-full", cols, rows)}>
      {slice.map((thumb) => (
        <div key={thumb.id} className="relative min-h-0 min-w-0">
          <Image
            src={thumb.imageUrl}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 640px) 14vw, 8vw"
            unoptimized={thumb.imageUrl.startsWith("data:") ? true : undefined}
          />
        </div>
      ))}
    </div>
  );
}

export function OutfitCalendar({
  year,
  month,
  saved,
  weeklyDrafts,
}: {
  year: number;
  month: number;
  saved: CalendarSavedOutfit[];
  weeklyDrafts: CalendarWeeklyLook[];
}) {
  const router = useRouter();
  const [pendingLookId, setPendingLookId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const byDaySaved = useMemo(() => {
    const m = new Map<string, CalendarSavedOutfit[]>();
    for (const o of saved) {
      const list = m.get(o.wornOn) ?? [];
      list.push(o);
      m.set(o.wornOn, list);
    }
    return m;
  }, [saved]);

  const byDayWeekly = useMemo(() => {
    const m = new Map<string, CalendarWeeklyLook>();
    for (const w of weeklyDrafts) {
      if (!m.has(w.wornOn)) m.set(w.wornOn, w);
    }
    return m;
  }, [weeklyDrafts]);

  const cells = useMemo(() => buildMonthCells(year, month), [year, month]);

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  const todayIso = productTodayIso();
  const title = formatProductMonthYear(year, month);

  const onApproveWeekly = useCallback(
    async (planLookId: string) => {
      setActionError(null);
      setPendingLookId(planLookId);
      try {
        const res = await approveWeeklyPlanLook(planLookId);
        if (!res.ok) {
          setActionError(res.message);
          return;
        }
        router.refresh();
      } catch {
        setActionError("Could not save this outfit. Try again.");
      } finally {
        setPendingLookId(null);
      }
    },
    [router],
  );

  return (
    <div className="flex min-h-[min(720px,78svh)] flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-foreground md:text-4xl">
            Outfit calendar
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Saved looks by day. Weekly AI plans show here until you approve them
            into your archive.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-2xl border border-border/70 bg-muted/30 p-1">
          <Link
            href={monthHref(prev.year, prev.month)}
            aria-label="Previous month"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "rounded-xl",
            )}
          >
            <ChevronLeft className="size-5" />
          </Link>
          <span className="min-w-[10rem] px-3 text-center font-medium text-foreground">
            {title}
          </span>
          <Link
            href={monthHref(next.year, next.month)}
            aria-label="Next month"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "rounded-xl",
            )}
          >
            <ChevronRight className="size-5" />
          </Link>
        </div>
      </div>

      {actionError ? (
        <p className="text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {WEEKDAY_LABELS.map((d) => (
          <div
            key={d}
            className="px-1 pb-1 text-center text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          >
            {d}
          </div>
        ))}
        {cells.map((cell, idx) => {
          if (cell.type === "empty") {
            return (
              <div
                key={`e-${idx}`}
                className={cn(CELL_ASPECT, "rounded-xl bg-muted/15")}
              />
            );
          }

          const key = isoDay(year, month, cell.day);
          const outfits = byDaySaved.get(key) ?? [];
          const weekly = byDayWeekly.get(key) ?? null;
          const isToday = key === todayIso;
          const primary = outfits[0];
          const heroUrl = primary?.imageUrl ?? weekly?.heroImageUrl ?? null;
          const thumbs = primary?.garmentThumbs ?? weekly?.garmentThumbs ?? [];
          const hasMedia = Boolean(heroUrl) || thumbs.length > 0;
          const label =
            primary?.name?.trim() || primary?.occasion || weekly?.title || null;
          const canApprove = Boolean(weekly) && outfits.length === 0;
          const isSaved = Boolean(primary);

          return (
            <div
              key={key}
              className={cn(
                CELL_ASPECT,
                "relative min-w-0 overflow-hidden rounded-xl bg-muted/30",
                isToday && "ring-1 ring-inset ring-primary/35",
              )}
            >
              <div className="absolute inset-0">
                <DayLookMedia heroUrl={heroUrl} thumbs={thumbs} />
              </div>

              <div className="relative z-10 flex items-start justify-between gap-1 p-1.5">
                <span
                  className={cn(
                    "text-xs font-semibold tabular-nums",
                    hasMedia
                      ? "rounded-md bg-black/45 px-1.5 py-0.5 text-white"
                      : "text-muted-foreground",
                  )}
                >
                  {cell.day}
                </span>
                {outfits.length > 1 ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[0.6rem] font-medium",
                      hasMedia
                        ? "bg-black/45 text-white"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    +{outfits.length - 1}
                  </span>
                ) : isSaved ? (
                  <span
                    className={cn(
                      "inline-flex size-5 items-center justify-center rounded-full",
                      hasMedia
                        ? "bg-black/45 text-white"
                        : "bg-muted text-primary",
                    )}
                    aria-label="Saved"
                  >
                    <Check className="size-3" />
                  </span>
                ) : null}
              </div>

              {label || canApprove ? (
                <div
                  className={cn(
                    "absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1.5 p-1.5 pt-8",
                    hasMedia
                      ? "bg-gradient-to-t from-black/75 via-black/35 to-transparent"
                      : null,
                  )}
                >
                  {label ? (
                    <p
                      className={cn(
                        "line-clamp-2 text-[0.65rem] leading-snug",
                        hasMedia ? "text-white" : "text-foreground/90",
                      )}
                    >
                      {label}
                    </p>
                  ) : null}
                  {canApprove && weekly ? (
                    <Button
                      type="button"
                      size="xs"
                      disabled={pendingLookId === weekly.planLookId}
                      className="h-6 w-full rounded-md text-[0.65rem] shadow-sm"
                      aria-label={`Approve ${weekly.title}`}
                      onClick={() => onApproveWeekly(weekly.planLookId)}
                    >
                      <Check className="size-3" />
                      {pendingLookId === weekly.planLookId
                        ? "Saving…"
                        : "Approve"}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
