export const CALENDAR_MONTH_TAG = "calendar-month" as const;

export function calendarMonthTag(userId: string) {
  return `${CALENDAR_MONTH_TAG}:${userId}` as const;
}
