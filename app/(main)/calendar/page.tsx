import { Suspense } from "react";
import { redirect } from "next/navigation";

import { OutfitCalendar } from "@/components/outfit/outfit-calendar";
import { requireAdmittedAccess } from "@/lib/auth/admitted";
import { AUTH_SIGN_IN_PATH } from "@/lib/auth/config";
import { getWearerUserId } from "@/lib/auth/wearer";
import { loadCalendarMonthData } from "@/lib/outfits/calendar-data";
import { productTodayIso } from "@/lib/time/product-timezone";

type Search = { year?: string; month?: string };

function clampMonthYear(sp: Search, todayIso: string) {
  // The default month has to come from the same product-timezone "today" the
  // grid highlights. Using the host Date() opened the wrong month for anyone
  // loading /calendar across a product-timezone boundary.
  const [todayYear, todayMonth] = todayIso.split("-").map(Number);
  const yRaw = parseInt(sp.year ?? "", 10);
  const mRaw = parseInt(sp.month ?? "", 10);
  const year = Number.isFinite(yRaw)
    ? Math.min(2100, Math.max(1970, yRaw))
    : todayYear!;
  const month =
    Number.isFinite(mRaw) && mRaw >= 1 && mRaw <= 12 ? mRaw : todayMonth!;
  return { year, month };
}

/**
 * Fallback and resolved content render through this one wrapper so the
 * prerendered shell and the resumed tree have the same shape (PPR matches
 * resume slots by position). Only the resolved content carries the test id.
 */
function CalendarFrame({
  isPlaceholder,
  children,
}: {
  isPlaceholder: boolean;
  children: React.ReactNode;
}) {
  return (
    <div data-testid={isPlaceholder ? undefined : "calendar-content"}>
      {children}
    </div>
  );
}

function CalendarFallback() {
  // Static placeholder month for the prerendered shell. No clock reads: the
  // shell is built once and must not depend on the time it was built.
  return (
    <CalendarFrame isPlaceholder>
      <OutfitCalendar
        year={2026}
        month={1}
        saved={[]}
        weeklyDrafts={[]}
        todayIso={null}
        isPlaceholder
      />
    </CalendarFrame>
  );
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
  // The single read of the clock; passed down so the client never computes
  // "today" itself and cannot disagree with the server.
  const todayIso = productTodayIso();
  const { year, month } = clampMonthYear(sp, todayIso);
  const { saved, weeklyDrafts } = await loadCalendarMonthData(
    userId,
    year,
    month,
  );

  return (
    <CalendarFrame isPlaceholder={false}>
      <OutfitCalendar
        year={year}
        month={month}
        saved={saved}
        weeklyDrafts={weeklyDrafts}
        todayIso={todayIso}
      />
    </CalendarFrame>
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
