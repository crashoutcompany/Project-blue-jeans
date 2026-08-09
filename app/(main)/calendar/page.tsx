import { Suspense } from "react";
import { redirect } from "next/navigation";

import { OutfitCalendar } from "@/components/outfit/outfit-calendar";
import { getWearerUserId } from "@/lib/auth/wearer";
import { loadCalendarMonthData } from "@/lib/outfits/calendar-data";

type Search = { year?: string; month?: string };

function clampMonthYear(sp: Search) {
  const now = new Date();
  const yRaw = parseInt(sp.year ?? "", 10);
  const mRaw = parseInt(sp.month ?? "", 10);
  const year = Number.isFinite(yRaw)
    ? Math.min(2100, Math.max(1970, yRaw))
    : now.getFullYear();
  const month =
    Number.isFinite(mRaw) && mRaw >= 1 && mRaw <= 12
      ? mRaw
      : now.getMonth() + 1;
  return { year, month };
}

function CalendarFallback() {
  return (
    <div className="mx-auto w-full max-w-[min(100%,88rem)] px-1 pb-10 sm:px-2">
      <div className="h-10 w-48 animate-pulse rounded-md bg-muted" />
      <div className="mt-6 grid grid-cols-7 gap-2">
        {Array.from({ length: 42 }, (_, i) => (
          <div
            key={i}
            className="aspect-square animate-pulse rounded-md bg-muted/60"
          />
        ))}
      </div>
    </div>
  );
}

async function CalendarMonth({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const userId = await getWearerUserId();
  if (!userId) {
    redirect("/auth/sign-in");
  }
  const sp = await searchParams;
  const { year, month } = clampMonthYear(sp);
  const { saved, weeklyDrafts } = await loadCalendarMonthData(
    userId,
    year,
    month,
  );

  return (
    <div className="mx-auto w-full max-w-[min(100%,88rem)] px-1 pb-10 sm:px-2">
      <OutfitCalendar
        year={year}
        month={month}
        saved={saved}
        weeklyDrafts={weeklyDrafts}
      />
    </div>
  );
}

export default function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  return (
    <Suspense fallback={<CalendarFallback />}>
      <CalendarMonth searchParams={searchParams} />
    </Suspense>
  );
}
