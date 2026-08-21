import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

import { authorizeCronRequest } from "@/lib/cron/authorize";
import { calendarMonthTag } from "@/lib/outfits/calendar-month-cache-tag";
import { purgeStaleWeeklyFits } from "@/lib/outfits/purge-stale-weekly-fits";

/**
 * Monday Vercel Cron: delete Weekly Fits from previous Sunday-start weeks.
 * Committed Outfits are kept.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!authorizeCronRequest(request)) {
    return NextResponse.json(
      { ok: false as const, message: "Unauthorized." },
      { status: 401 },
    );
  }

  const result = await purgeStaleWeeklyFits();
  if (!result.ok) {
    return NextResponse.json(
      { ok: false as const, message: result.message },
      { status: 503 },
    );
  }

  for (const userId of result.userIds) {
    revalidateTag(calendarMonthTag(userId), "max");
  }
  if (result.userIds.length > 0) {
    revalidatePath("/");
    revalidatePath("/calendar");
  }

  return NextResponse.json({
    ok: true as const,
    deletedPlans: result.deletedPlans,
  });
}
