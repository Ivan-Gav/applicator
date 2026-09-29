import { render } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { timeZoneCookie } from "@/lib/time-zone";
import { TimeZoneSync } from "./TimeZoneSync";

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));

const refresh = vi.fn();

function browserZoneIs(timeZone: string) {
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
    timeZone,
  } as Intl.ResolvedDateTimeFormatOptions);
}

function zoneCookie(): string | undefined {
  return document.cookie
    .split("; ")
    .find((pair) => pair.startsWith(`${timeZoneCookie}=`))
    ?.slice(timeZoneCookie.length + 1);
}

beforeEach(() => {
  vi.mocked(useRouter).mockReturnValue({ refresh } as unknown as ReturnType<typeof useRouter>);
});

afterEach(() => {
  document.cookie = `${timeZoneCookie}=; path=/; max-age=0`;
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("TimeZoneSync", () => {
  it("reports the browser's zone and renders the page again", () => {
    browserZoneIs("America/New_York");

    render(<TimeZoneSync />);

    expect(decodeURIComponent(zoneCookie() ?? "")).toBe("America/New_York");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("does nothing when the server already knows the zone", () => {
    browserZoneIs("Europe/Berlin");
    document.cookie = `${timeZoneCookie}=${encodeURIComponent("Europe/Berlin")}; path=/`;

    render(<TimeZoneSync />);

    expect(refresh).not.toHaveBeenCalled();
  });

  it("replaces the zone after the browser has moved", () => {
    browserZoneIs("Asia/Tokyo");
    document.cookie = `${timeZoneCookie}=${encodeURIComponent("Europe/Berlin")}; path=/`;

    render(<TimeZoneSync />);

    expect(decodeURIComponent(zoneCookie() ?? "")).toBe("Asia/Tokyo");
    expect(refresh).toHaveBeenCalledOnce();
  });
});
