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
  // Static placeholder month for the prerendered shell (no Date.now()).
  return <OutfitCalendar year={2026} month={1} saved={[]} weeklyDrafts={[]} />;
}

async function CalendarContent({
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
    <div data-testid="calendar-content">
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
      <CalendarContent searchParams={searchParams} />
    </Suspense>
  );
}
