"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isTimeZone, timeZoneCookie } from "@/lib/time-zone";

const oneYearInSeconds = 60 * 60 * 24 * 365;

function currentCookie(name: string): string | null {
  const entry = document.cookie.split("; ").find((pair) => pair.startsWith(`${name}=`));
  return entry === undefined ? null : decodeURIComponent(entry.slice(name.length + 1));
}

/**
 * Reports the browser's time zone to the server in a cookie. When it changes,
 * the page is rendered again so that its dates use the new zone.
 */
export function TimeZoneSync() {
  const router = useRouter();

  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!isTimeZone(zone) || currentCookie(timeZoneCookie) === zone) {
      return;
    }
    document.cookie = `${timeZoneCookie}=${encodeURIComponent(zone)}; path=/; max-age=${oneYearInSeconds}; samesite=lax`;
    router.refresh();
  }, [router]);

  return null;
}
