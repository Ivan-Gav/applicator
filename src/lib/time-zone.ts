// The browser reports its IANA time zone here; the server formats dates with it.
export const timeZoneCookie = "tz";

export const fallbackTimeZone = "UTC";

export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value === "") {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** The zone a cookie value names, or UTC when it names none. */
export function resolveTimeZone(value: unknown): string {
  return isTimeZone(value) ? value : fallbackTimeZone;
}
