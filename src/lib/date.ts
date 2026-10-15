import { normalizeForSearch } from "./normalize-for-search";

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

/** The day of an instant in this runtime's time zone as YYYY-MM-DD; the inverse of startOfLocalDay. */
export function localDay(instant: Date): string {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}`;
}

// English and German month names and their common abbreviations, as
// normalizeForSearch leaves them ("März" becomes "marz"), January first.
const monthNames: readonly (readonly string[])[] = [
  ["january", "januar", "janner", "jan"],
  ["february", "februar", "feb"],
  ["march", "marz", "maerz", "mar", "mrz"],
  ["april", "apr"],
  ["may", "mai"],
  ["june", "juni", "jun"],
  ["july", "juli", "jul"],
  ["august", "aug"],
  ["september", "sept", "sep"],
  ["october", "oktober", "oct", "okt"],
  ["november", "nov"],
  ["december", "dezember", "dec", "dez"],
];

const yearFirst = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s]\d{1,2}:\d{2}\S*)?$/;
const dayFirstWithDots = /^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})$/;
const yearLast = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
const dayThenMonthName = /^(\d{1,2}) ([a-z]+) (\d{4})$/;
const monthNameThenDay = /^([a-z]+) (\d{1,2}) (\d{4})$/;

function asDay(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDay =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return isRealDay ? date.toISOString().slice(0, 10) : null;
}

// The three numbers a numeric pattern captured, in the order written.
function numbersOf(match: RegExpExecArray): [number, number, number] {
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function withMonthName(name: string, day: string, year: string): string | null {
  const month = monthNames.findIndex((names) => names.includes(name)) + 1;
  return month === 0 ? null : asDay(Number(year), month, Number(day));
}

/**
 * A day written by a person, as YYYY-MM-DD, or null when the text does not
 * name exactly one real day. Read: year first ("2026-09-01", also with a time
 * after it), day first with dots ("01.09.2026"), a month by its English or
 * German name ("1 September 2026", "Sept 1st, 2026"), and day and month as
 * numbers with slashes or dashes only where one reading alone is a real day
 * or both readings are the same day ("13/09/2026", but not "09/01/2026").
 */
export function readDay(text: string): string | null {
  const trimmed = text.trim();

  const isoLike = yearFirst.exec(trimmed);
  if (isoLike) {
    const [year, month, day] = numbersOf(isoLike);
    return asDay(year, month, day);
  }
  const dotted = dayFirstWithDots.exec(trimmed);
  if (dotted) {
    const [day, month, year] = numbersOf(dotted);
    return asDay(year, month, day);
  }
  const slashed = yearLast.exec(trimmed);
  if (slashed) {
    const [first, second, year] = numbersOf(slashed);
    const dayFirst = asDay(year, second, first);
    const monthFirst = asDay(year, first, second);
    if (dayFirst === null || monthFirst === null || dayFirst === monthFirst) {
      return dayFirst ?? monthFirst;
    }
    return null;
  }

  const words = normalizeForSearch(trimmed).replace(/\b(\d{1,2})(?:st|nd|rd|th)\b/g, "$1");
  const dayThenName = dayThenMonthName.exec(words);
  if (dayThenName) {
    const [, day = "", name = "", year = ""] = dayThenName;
    return withMonthName(name, day, year);
  }
  const nameThenDay = monthNameThenDay.exec(words);
  if (nameThenDay) {
    const [, name = "", day = "", year = ""] = nameThenDay;
    return withMonthName(name, day, year);
  }
  return null;
}
