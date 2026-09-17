import { Suspense } from "react";
import { redirect } from "next/navigation";

import { OutfitCalendar } from "@/components/outfit/outfit-calendar";
import { requireAdmittedAccess } from "@/lib/auth/admitted";
import { AUTH_SIGN_IN_PATH } from "@/lib/auth/config";
import { getWearerUserId } from "@/lib/auth/wearer";
import { loadCalendarMonthData } from "@/lib/outfits/calendar-data";
import { productTodayIso } from "@/lib/time/product-timezone";

type Search = { year?: string; month?: string };

function clampMonthYear(sp: Search) {
  // The grid highlights "today" from productTodayIso(), so the default month
  // has to come from the same clock. Using the host Date() opened the wrong
  // month for anyone loading /calendar across a product-timezone boundary.
  const [todayYear, todayMonth] = productTodayIso().split("-").map(Number);
  const yRaw = parseInt(sp.year ?? "", 10);
  const mRaw = parseInt(sp.month ?? "", 10);
  const year = Number.isFinite(yRaw)
    ? Math.min(2100, Math.max(1970, yRaw))
    : todayYear!;
  const month =
    Number.isFinite(mRaw) && mRaw >= 1 && mRaw <= 12 ? mRaw : todayMonth!;
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
  await requireAdmittedAccess();
  const userId = await getWearerUserId();
  if (!userId) {
    redirect(AUTH_SIGN_IN_PATH);
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
