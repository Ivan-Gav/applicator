import { type CalendarDay, calendarDayAsUtc } from "@/lib/calendar-day";
import { formatDay } from "@/lib/date";

// Calendar days carry no zone: each is formatted as its own midnight in UTC.
const utc = "UTC";

const shortDay = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: utc,
});
const shortMonth = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: utc });
const monthAndYear = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
  timeZone: utc,
});

/** "10 Aug" */
export function dayLabel(day: CalendarDay): string {
  return shortDay.format(calendarDayAsUtc(day));
}

/** "Aug" */
export function monthLabel(day: CalendarDay): string {
  return shortMonth.format(calendarDayAsUtc(day));
}

/** "21 Sept 2026", as dates read elsewhere in the app. */
export function dayTitle(day: CalendarDay): string {
  return formatDay(calendarDayAsUtc(day), utc);
}

/** "Sept 2026" */
export function monthTitle(day: CalendarDay): string {
  return monthAndYear.format(calendarDayAsUtc(day));
}
