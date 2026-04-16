import { OutfitCalendar } from "@/components/outfit/outfit-calendar";
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

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const { year, month } = clampMonthYear(sp);
  const { saved, weeklyDrafts } = await loadCalendarMonthData(year, month);

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
