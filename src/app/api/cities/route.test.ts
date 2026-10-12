import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requireUser } from "@/app/auth/_utils/require-user";
import { citySearchParam, routes, signInPath } from "@/app/routes";
import type { CityMatch } from "@/domain/city/model";
import { GET } from "./route";

vi.mock("@/app/auth/_utils/require-user", () => ({ requireUser: vi.fn() }));

const sessionUser = {
  id: "00000000-0000-4000-8000-00000000000a",
  email: "ivan@example.test",
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
};

function search(query: string) {
  const url = new URL(routes.apiCities, "http://localhost:3000");
  url.searchParams.set(citySearchParam, query);
  return GET(new NextRequest(url));
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/cities", () => {
  it("answers with the matching cities of the committed list, the obvious one first", async () => {
    vi.mocked(requireUser).mockResolvedValue(sessionUser);

    const response = await search("münchen");
    const cities = (await response.json()) as CityMatch[];

    expect(response.status).toBe(200);
    expect(cities[0]).toMatchObject({ name: "Munich", country: "Germany", region: "Bavaria" });
    expect(cities.length).toBeLessThanOrEqual(8);
  });

  it("answers with no city for a name the list does not know", async () => {
    vi.mocked(requireUser).mockResolvedValue(sessionUser);

    await expect((await search("Qwxyzz")).json()).resolves.toEqual([]);
  });

  it("searches nothing without a session", async () => {
    // requireUser() ends the request with a redirect, which Next.js delivers as a throw.
    const redirected = new Error(`redirected to ${signInPath()}`);
    vi.mocked(requireUser).mockRejectedValue(redirected);

    await expect(search("Munich")).rejects.toBe(redirected);
  });
});
