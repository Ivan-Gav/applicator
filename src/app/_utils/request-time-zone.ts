import { cookies } from "next/headers";
import { resolveTimeZone, timeZoneCookie } from "@/lib/time-zone";

/** The viewer's time zone as their browser reported it; UTC until it has. */
export async function requestTimeZone(): Promise<string> {
  return resolveTimeZone((await cookies()).get(timeZoneCookie)?.value);
}
