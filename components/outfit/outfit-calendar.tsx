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
import { WoreThisButton } from "@/components/outfit/wore-this-button";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { shouldBypassImageOptimizer } from "@/lib/media/display";
import {
  formatProductMonthYear,
  formatProductWornOn,
} from "@/lib/time/product-timezone";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

const CELL_ASPECT = "aspect-[3/4]";

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function monthHref(y: number, m: number) {
  return `/calendar?year=${y}&month=${m}`;
}

function padGridStartSunday(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

function buildMonthCells(year: number, month: number) {
  const pad = padGridStartSunday(year, month);
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: ({ type: "empty" } | { type: "day"; day: number })[] = [];
  for (let i = 0; i < pad; i++) cells.push({ type: "empty" });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ type: "day", day: d });
  // Only complete the final week; padding to a fixed 6 rows rendered a whole
  // extra week of blanks for months that fit in 4 or 5.
  while (cells.length % 7 !== 0) cells.push({ type: "empty" });
  return cells;
}

function isoDay(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const CELL_IMAGE_SIZES =
  "(max-width: 640px) 28vw, (max-width: 1024px) 14vw, 12vw";
const CELL_THUMB_SIZES = "(max-width: 640px) 14vw, 8vw";

function DayLookMedia({
  heroUrl,
  thumbs,
  sizes = CELL_IMAGE_SIZES,
  thumbSizes = CELL_THUMB_SIZES,
}: {
  heroUrl: string | null;
  thumbs: CalendarLookThumb[];
  sizes?: string;
  thumbSizes?: string;
}) {
  if (heroUrl) {
    return (
      <Image
        src={heroUrl}
        alt=""
        fill
        className="object-cover"
        sizes={sizes}
        unoptimized={shouldBypassImageOptimizer(heroUrl) ? true : undefined}
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
            sizes={thumbSizes}
            unoptimized={
              shouldBypassImageOptimizer(thumb.imageUrl) ? true : undefined
            }
          />
        </div>
      ))}
    </div>
  );
}

type DayLook = {
  key: string;
  outfits: CalendarSavedOutfit[];
  weekly: CalendarWeeklyLook | null;
  primary: CalendarSavedOutfit | undefined;
  heroUrl: string | null;
  thumbs: CalendarLookThumb[];
  hasMedia: boolean;
  label: string | null;
  canApprove: boolean;
  canMarkWorn: boolean;
};

function dayLook(
  key: string,
  byDaySaved: Map<string, CalendarSavedOutfit[]>,
  byDayWeekly: Map<string, CalendarWeeklyLook>,
  todayIso: string | null,
): DayLook {
  const outfits = byDaySaved.get(key) ?? [];
  const weekly = byDayWeekly.get(key) ?? null;
  const primary = outfits[0];
  const heroUrl = primary?.imageUrl ?? weekly?.heroImageUrl ?? null;
  const thumbs = primary?.garmentThumbs ?? weekly?.garmentThumbs ?? [];
  return {
    key,
    outfits,
    weekly,
    primary,
    heroUrl,
    thumbs,
    hasMedia: Boolean(heroUrl) || thumbs.length > 0,
    label: primary?.name?.trim() || primary?.occasion || weekly?.title || null,
    canApprove: Boolean(weekly) && outfits.length === 0,
    // Only a day that has happened can be marked worn.
    canMarkWorn: Boolean(primary) && todayIso !== null && key <= todayIso,
  };
}

/**
 * Phone-only status mark in a day tile's corner, standing in for the label
 * and buttons that only fit from `sm` up.
 */
function DayStatusMark({ look }: { look: DayLook }) {
  if (look.primary) {
    const worn = look.primary.worn;
    return (
      <span
        aria-hidden
        className={cn(
          "inline-flex size-4 items-center justify-center rounded-full shadow-sm",
          worn
            ? "bg-primary text-primary-foreground"
            : "bg-black/55 text-white",
        )}
      >
        <Check className="size-2.5" strokeWidth={3} />
      </span>
    );
  }
  if (look.weekly) {
    return (
      <span
        aria-hidden
        className="block size-2.5 rounded-full bg-primary shadow-sm ring-2 ring-black/40"
      />
    );
  }
  return null;
}

/** Day number and, from `sm` up, the saved / "+N" chip. */
function CellTopRow({ day, look }: { day: number; look: DayLook }) {
  const { outfits, primary, hasMedia } = look;
  let chip: React.ReactNode = null;
  if (outfits.length > 1) {
    chip = (
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[0.6rem] font-medium max-sm:hidden",
          hasMedia
            ? "bg-black/45 text-white"
            : "bg-muted text-muted-foreground",
        )}
      >
        +{outfits.length - 1}
      </span>
    );
  } else if (primary) {
    chip = (
      <span
        className={cn(
          "inline-flex size-5 items-center justify-center rounded-full max-sm:hidden",
          hasMedia ? "bg-black/45 text-white" : "bg-muted text-primary",
        )}
        aria-label="Saved"
      >
        <Check className="size-3" />
      </span>
    );
  }
  return (
    <div className="relative z-10 flex items-start justify-between gap-1 p-1 sm:p-1.5">
      <span
        className={cn(
          "text-xs font-semibold tabular-nums",
          hasMedia && "max-sm:px-1 max-sm:text-[0.7rem]",
          hasMedia
            ? "rounded-md bg-black/45 px-1.5 py-0.5 text-white"
            : "text-muted-foreground",
        )}
      >
        {day}
      </span>
      {chip}
    </div>
  );
}

/**
 * The look's title with Approve / Wore this along the tile's bottom. Only
 * from `sm` up: on phones they don't fit, and the day sheet carries them.
 */
function CellDesktopFooter({
  look,
  pendingLookId,
  onApproveWeekly,
  onError,
}: {
  look: DayLook;
  pendingLookId: string | null;
  onApproveWeekly: (planLookId: string) => void;
  onError: (message: string | null) => void;
}) {
  const { weekly, primary, hasMedia, label, canApprove, canMarkWorn } = look;
  if (!label && !canApprove && !canMarkWorn) return null;
  const approving = weekly !== null && pendingLookId === weekly.planLookId;
  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 z-10 hidden flex-col gap-1.5 p-1.5 pt-8 sm:flex",
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
          disabled={approving}
          className="h-6 w-full rounded-md text-[0.65rem] shadow-sm"
          aria-label={`Approve ${weekly.title}`}
          onClick={() => onApproveWeekly(weekly.planLookId)}
        >
          <Check className="size-3" />
          {approving ? "Saving…" : "Approve"}
        </Button>
      ) : null}
      {canMarkWorn && primary ? (
        <WoreThisButton
          wornOn={look.key}
          worn={primary.worn}
          size="xs"
          className="h-6 w-full rounded-md text-[0.65rem] shadow-sm"
          onError={onError}
        />
      ) : null}
    </div>
  );
}

/** One day tile in the month grid. */
function CalendarDayCell({
  day,
  look,
  isToday,
  onOpen,
  ...footerProps
}: {
  day: number;
  look: DayLook;
  isToday: boolean;
  pendingLookId: string | null;
  onApproveWeekly: (planLookId: string) => void;
  onError: (message: string | null) => void;
  onOpen: () => void;
}) {
  const hasLook = Boolean(look.primary) || Boolean(look.weekly);
  return (
    <div
      aria-current={isToday ? "date" : undefined}
      className={cn(
        CELL_ASPECT,
        "relative min-w-0 overflow-hidden rounded-xl border border-foreground/10 bg-muted/60",
        isToday && "ring-1 ring-inset ring-primary/35",
      )}
    >
      <div className="absolute inset-0">
        <DayLookMedia heroUrl={look.heroUrl} thumbs={look.thumbs} />
      </div>
      <CellTopRow day={day} look={look} />
      <CellDesktopFooter look={look} {...footerProps} />
      {hasLook ? (
        <>
          <div className="pointer-events-none absolute right-1 bottom-1 z-10 sm:hidden">
            <DayStatusMark look={look} />
          </div>
          {/* Phones: the whole tile opens the day's detail sheet. */}
          <button
            type="button"
            className="absolute inset-0 z-20 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:hidden"
            aria-label={`Open ${formatProductWornOn(look.key)}${look.label ? `: ${look.label}` : ""}`}
            aria-haspopup="dialog"
            onClick={onOpen}
          />
        </>
      ) : null}
    </div>
  );
}

/** Phone-only key for the tiles' status marks. */
function PhoneLegend() {
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:hidden"
      aria-hidden
    >
      <span className="inline-flex items-center gap-1.5">
        <span className="block size-2.5 rounded-full bg-primary" />
        Plan to approve
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex size-4 items-center justify-center rounded-full bg-black/55 text-white">
          <Check className="size-2.5" strokeWidth={3} />
        </span>
        Saved
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-2.5" strokeWidth={3} />
        </span>
        Worn
      </span>
    </div>
  );
}

export function OutfitCalendar({
  year,
  month,
  saved,
  weeklyDrafts,
  todayIso,
  isPlaceholder = false,
}: {
  year: number;
  month: number;
  saved: CalendarSavedOutfit[];
  weeklyDrafts: CalendarWeeklyLook[];
  /**
   * Product-timezone today (YYYY-MM-DD), computed once on the server. Never
   * read the clock here: this runs during prerender and on the client, and a
   * clock read in the Suspense fallback broke the PPR resume. `null` on the
   * placeholder, which has no "today".
   */
  todayIso: string | null;
  /** Prerendered shell with no real data yet; skip the empty state. */
  isPlaceholder?: boolean;
}) {
  const router = useRouter();
  const [pendingLookId, setPendingLookId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  /** Day open in the phone detail sheet (YYYY-MM-DD), if any. */
  const [openDay, setOpenDay] = useState<string | null>(null);

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
  const isMonthEmpty =
    !isPlaceholder && saved.length === 0 && weeklyDrafts.length === 0;

  const lookDays = useMemo(() => {
    const keys = new Set<string>([...byDaySaved.keys(), ...byDayWeekly.keys()]);
    return [...keys].sort();
  }, [byDaySaved, byDayWeekly]);

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

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
    <div className="mx-auto flex min-h-[min(720px,78svh)] w-full max-w-[88rem] flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-foreground md:text-4xl">
            Outfit calendar
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Saved looks by day. Weekly AI plans show here until you approve them
            into your archive. Tap Wore this on a day you actually wore it.
            <span className="sm:hidden"> Tap a day to open its look.</span>
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

      {isMonthEmpty ? (
        <div className="px-1 py-6 text-center" role="status">
          <p className="text-[13px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
            No looks planned yet
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Commit a look from Today or plan the week and it will show up here.
          </p>
          <Link
            href="/"
            className={cn(buttonVariants({ size: "sm" }), "mt-4 rounded-none")}
          >
            Go to Today
          </Link>
        </div>
      ) : null}

      <div
        data-testid="calendar-grid"
        className="grid grid-cols-7 gap-1 sm:gap-1.5"
      >
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
          return (
            <CalendarDayCell
              key={key}
              day={cell.day}
              look={dayLook(key, byDaySaved, byDayWeekly, todayIso)}
              isToday={todayIso !== null && key === todayIso}
              pendingLookId={pendingLookId}
              onApproveWeekly={onApproveWeekly}
              onError={setActionError}
              onOpen={() => {
                setActionError(null);
                setOpenDay(key);
              }}
            />
          );
        })}
      </div>

      {lookDays.length > 0 ? <PhoneLegend /> : null}

      <DaySheet
        openDay={openDay}
        lookDays={lookDays}
        onOpenDayChange={(key) => {
          setActionError(null);
          setOpenDay(key);
        }}
        getLook={(key) => dayLook(key, byDaySaved, byDayWeekly, todayIso)}
        pendingLookId={pendingLookId}
        actionError={actionError}
        onApproveWeekly={onApproveWeekly}
        onError={setActionError}
      />
    </div>
  );
}

function dayStatus(look: DayLook): string | null {
  if (look.primary) {
    const base = look.primary.worn ? "Saved and worn" : "Saved to your archive";
    const more = look.outfits.length - 1;
    return more > 0 ? `${base} (+${more} more this day)` : base;
  }
  return look.weekly ? "Weekly plan, not approved yet" : null;
}

type SheetActionProps = {
  pendingLookId: string | null;
  onApproveWeekly: (planLookId: string) => void;
  onError: (message: string | null) => void;
};

/** Full-width, thumb-sized Approve / Wore this for the open day. */
function DaySheetActions({
  look,
  pendingLookId,
  onApproveWeekly,
  onError,
}: SheetActionProps & { look: DayLook }) {
  const { weekly, primary } = look;
  const approving = weekly !== null && pendingLookId === weekly.planLookId;
  return (
    <div className="flex flex-col gap-2 p-4">
      {look.canApprove && weekly ? (
        <Button
          type="button"
          disabled={approving}
          className="h-11 w-full rounded-xl text-sm"
          aria-label={`Approve ${weekly.title}`}
          onClick={() => onApproveWeekly(weekly.planLookId)}
        >
          <Check className="size-4" />
          {approving ? "Saving…" : "Approve"}
        </Button>
      ) : null}
      {look.canMarkWorn && primary ? (
        <WoreThisButton
          wornOn={look.key}
          worn={primary.worn}
          size="sm"
          className="h-11 w-full rounded-xl text-sm"
          onError={onError}
        />
      ) : null}
    </div>
  );
}

/** The open day's photo, flanked by arrows to the neighbouring looks. */
function DaySheetPhoto({
  look,
  prevDay,
  nextDay,
  onStep,
}: {
  look: DayLook;
  prevDay: string | null;
  nextDay: string | null;
  onStep: (key: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 px-4">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 shrink-0 rounded-xl"
        aria-label="Previous look"
        disabled={!prevDay}
        onClick={() => prevDay && onStep(prevDay)}
      >
        <ChevronLeft className="size-5" />
      </Button>
      <div className="relative mx-auto aspect-[3/4] h-[min(46svh,22rem)] overflow-hidden rounded-2xl border border-foreground/10 bg-muted/60">
        <DayLookMedia
          heroUrl={look.heroUrl}
          thumbs={look.thumbs}
          sizes="70vw"
          thumbSizes="35vw"
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 shrink-0 rounded-xl"
        aria-label="Next look"
        disabled={!nextDay}
        onClick={() => nextDay && onStep(nextDay)}
      >
        <ChevronRight className="size-5" />
      </Button>
    </div>
  );
}

/**
 * Phone detail sheet for one day: the look's photo and title at a readable
 * size, with Approve / Wore this as full-width, thumb-sized buttons. Arrows
 * step through the month's days that have a look.
 */
function DaySheet({
  openDay,
  lookDays,
  onOpenDayChange,
  getLook,
  actionError,
  ...actionProps
}: SheetActionProps & {
  openDay: string | null;
  lookDays: string[];
  onOpenDayChange: (key: string | null) => void;
  getLook: (key: string) => DayLook;
  actionError: string | null;
}) {
  const look = openDay ? getLook(openDay) : null;
  const idx = openDay ? lookDays.indexOf(openDay) : -1;

  return (
    <Sheet
      open={openDay !== null}
      onOpenChange={(open) => {
        if (!open) onOpenDayChange(null);
      }}
    >
      <SheetContent
        side="bottom"
        className="max-h-[90svh] gap-0 overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-md"
      >
        {look ? (
          <>
            <SheetHeader className="pr-12">
              <SheetTitle className="text-lg">
                {formatProductWornOn(look.key)}
              </SheetTitle>
              <SheetDescription>{dayStatus(look)}</SheetDescription>
            </SheetHeader>
            <DaySheetPhoto
              look={look}
              prevDay={lookDays[idx - 1] ?? null}
              nextDay={idx >= 0 ? (lookDays[idx + 1] ?? null) : null}
              onStep={onOpenDayChange}
            />
            {look.label ? (
              <p className="px-4 pt-3 text-center font-serif text-xl leading-snug text-foreground">
                {look.label}
              </p>
            ) : null}
            {actionError ? (
              <p
                className="px-4 pt-2 text-center text-sm text-destructive"
                role="alert"
              >
                {actionError}
              </p>
            ) : null}
            <DaySheetActions look={look} {...actionProps} />
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
