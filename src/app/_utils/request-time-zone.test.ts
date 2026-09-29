import { cookies } from "next/headers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fallbackTimeZone, timeZoneCookie } from "@/lib/time-zone";
import { requestTimeZone } from "./request-time-zone";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

function withCookies(jar: Record<string, string>) {
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) => (name in jar ? { name, value: jar[name] } : undefined),
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("requestTimeZone", () => {
  it("is the zone the browser reported", async () => {
    withCookies({ [timeZoneCookie]: "Europe/Berlin" });

    await expect(requestTimeZone()).resolves.toBe("Europe/Berlin");
  });

  it("is UTC before the browser has reported one", async () => {
    withCookies({});

    await expect(requestTimeZone()).resolves.toBe(fallbackTimeZone);
  });

  it("is UTC when the cookie names no real zone", async () => {
    withCookies({ [timeZoneCookie]: "Mars/Olympus" });

    await expect(requestTimeZone()).resolves.toBe(fallbackTimeZone);
  });
});
