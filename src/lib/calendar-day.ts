/** A day of the calendar as "YYYY-MM-DD", in no time zone. Compares in order as a string. */
export type CalendarDay = string;

const dayPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whether `value` is a real day written as YYYY-MM-DD. */
export function isCalendarDay(value: unknown): value is CalendarDay {
  if (typeof value !== "string") {
    return false;
  }
  const match = dayPattern.exec(value);
  if (!match) {
    return false;
  }
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** Midnight UTC of the day: an instant to format with `timeZone: "UTC"`, which shows that day. */
export function calendarDayAsUtc(day: CalendarDay): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

function fromUtc(instant: Date): CalendarDay {
  return instant.toISOString().slice(0, 10);
}

export function addDays(day: CalendarDay, days: number): CalendarDay {
  return fromUtc(new Date(calendarDayAsUtc(day).getTime() + days * MS_PER_DAY));
}

/** The Monday of the week holding `day`. */
export function mondayOf(day: CalendarDay): CalendarDay {
  const weekday = calendarDayAsUtc(day).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

/** The first day of the month holding `day`. */
export function firstOfMonth(day: CalendarDay): CalendarDay {
  return `${day.slice(0, 7)}-01`;
}

/** The first day of the month `months` after the month holding `day`. */
export function addMonths(day: CalendarDay, months: number): CalendarDay {
  const start = calendarDayAsUtc(firstOfMonth(day));
  return fromUtc(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 1)));
}

/** The earlier of two days. */
export function earlierDay(a: CalendarDay, b: CalendarDay): CalendarDay {
  return a <= b ? a : b;
}

/** The later of two days. */
export function laterDay(a: CalendarDay, b: CalendarDay): CalendarDay {
  return a >= b ? a : b;
}

/**
 * The day an instant falls on in `timeZone`. One formatter serves every call,
 * so it suits converting many instants.
 */
export function dayInZone(timeZone: string): (instant: Date) => CalendarDay {
  const format = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return (instant) => {
    const parts = format.formatToParts(instant);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((candidate) => candidate.type === type)?.value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  };
}
