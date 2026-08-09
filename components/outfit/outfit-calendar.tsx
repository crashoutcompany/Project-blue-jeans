"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";

import { approveWeeklyPlanLook } from "@/app/actions/outfits";
import type {
  CalendarSavedOutfit,
  CalendarWeeklyLook,
} from "@/lib/outfits/calendar-data";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

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

  const cells = useMemo(
    () => buildMonthCells(year, month),
    [year, month],
  );

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  const title = new Date(year, month - 1, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

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
    <div className="flex min-h-[min(720px,78svh)] flex-col gap-4">
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

      <div className="grid min-h-0 flex-1 grid-cols-7 gap-px overflow-hidden rounded-3xl border border-border/80 bg-border/60">
        {WEEKDAY_LABELS.map((d) => (
          <div
            key={d}
            className="bg-muted/50 px-2 py-2 text-center text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          >
            {d}
          </div>
        ))}
        {cells.map((cell, idx) => {
          if (cell.type === "empty") {
            return (
              <div
                key={`e-${idx}`}
                className="min-h-[clamp(5.5rem,12vh,8rem)] bg-muted/15"
              />
            );
          }

          const key = isoDay(year, month, cell.day);
          const outfits = byDaySaved.get(key) ?? [];
          const weekly = byDayWeekly.get(key) ?? null;
          const now = new Date();
          const isToday =
            now.getFullYear() === year &&
            now.getMonth() + 1 === month &&
            now.getDate() === cell.day;
          const primary = outfits[0];
          const thumb =
            primary?.imageUrl ??
            weekly?.heroImageUrl ??
            null;
          const label =
            primary?.name?.trim() ||
            primary?.occasion ||
            weekly?.title ||
            null;

          return (
            <div
              key={key}
              className={cn(
                "flex min-h-[clamp(5.5rem,12vh,8rem)] flex-col gap-1.5 bg-background p-2",
                isToday && "ring-1 ring-inset ring-primary/35",
              )}
            >
              <div className="flex items-start justify-between gap-1">
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                  {cell.day}
                </span>
                {outfits.length > 1 ? (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.6rem] font-medium text-muted-foreground">
                    +{outfits.length - 1}
                  </span>
                ) : null}
              </div>

              <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-muted/40">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb}
                    alt=""
                    className="absolute inset-0 size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full min-h-[4rem] items-center justify-center text-[0.65rem] text-muted-foreground">
                    —
                  </div>
                )}
              </div>

              {label ? (
                <p className="line-clamp-2 text-[0.65rem] leading-snug text-foreground/90">
                  {label}
                </p>
              ) : null}

              {weekly && outfits.length === 0 ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={pendingLookId === weekly.planLookId}
                  className="h-7 w-full rounded-lg text-[0.7rem]"
                  onClick={() => onApproveWeekly(weekly.planLookId)}
                >
                  <Check className="mr-1 size-3" />
                  {pendingLookId === weekly.planLookId
                    ? "Saving…"
                    : "Approve"}
                </Button>
              ) : null}

              {primary && outfits.length > 0 ? (
                <div className="flex items-center gap-1 text-[0.6rem] text-muted-foreground">
                  <Check className="size-3 shrink-0 text-primary" />
                  Saved
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
