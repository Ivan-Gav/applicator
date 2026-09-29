const dayPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The start of a YYYY-MM-DD day in this runtime's time zone, or null for
 * anything that is not a real day. Meaningful only in the browser, where the
 * runtime's zone is the user's.
 */
export function startOfLocalDay(day: string): Date | null {
  const match = dayPattern.exec(day);
  if (!match) {
    return null;
  }
  const [year, month, date] = match.slice(1).map(Number) as [number, number, number];
  const start = new Date(year, month - 1, date);
  const isSameDay =
    start.getFullYear() === year && start.getMonth() === month - 1 && start.getDate() === date;
  return isSameDay ? start : null;
}

/** The day of an instant in `timeZone`, for display, e.g. "1 Sept 2026". */
export function formatDay(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone }).format(instant);
}

/** The day of an instant in `timeZone` as YYYY-MM-DD, e.g. for <time dateTime>. */
export function isoDay(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
