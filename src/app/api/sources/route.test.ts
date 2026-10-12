import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applicationRepositoryForRequest } from "@/adapters/supabase/application.repository";
import { requireUser } from "@/app/auth/_utils/require-user";
import { routes, signInPath, sourceSearchParam } from "@/app/routes";
import { createApplicationSchema } from "@/domain/application/schema";
import { knownSources } from "@/domain/source/known-sources";
import { InMemoryApplicationRepository } from "@/test/in-memory-application.repository";
import { GET } from "./route";

vi.mock("@/adapters/supabase/application.repository", () => ({
  applicationRepositoryForRequest: vi.fn(),
}));
vi.mock("@/app/auth/_utils/require-user", () => ({ requireUser: vi.fn() }));

const sessionUser = {
  id: "00000000-0000-4000-8000-00000000000a",
  email: "ivan@example.test",
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
};
const otherUser = "00000000-0000-4000-8000-00000000000b";

let repository: InMemoryApplicationRepository;

beforeEach(() => {
  repository = new InMemoryApplicationRepository();
  vi.mocked(applicationRepositoryForRequest).mockResolvedValue(repository);
  vi.mocked(requireUser).mockResolvedValue(sessionUser);
});

afterEach(() => {
  vi.clearAllMocks();
});

function withSource(userId: string, source: string) {
  return repository.create(
    userId,
    createApplicationSchema.parse({ companyName: "Acme", positionTitle: "Engineer", source }),
  );
}

async function search(query: string): Promise<string[]> {
  const url = new URL(routes.apiSources, "http://localhost:3000");
  url.searchParams.set(sourceSearchParam, query);
  const response = await GET(new NextRequest(url));
  expect(response.status).toBe(200);
  return (await response.json()) as string[];
}

describe("GET /api/sources", () => {
  it("answers with the known sources matching the search, in the spelling they are known by", async () => {
    await expect(search("linked in")).resolves.toEqual(["LinkedIn"]);
  });

  it("answers a blank search with every known source, in the list's order", async () => {
    await withSource(sessionUser.id, "Berlin Tech Meetup");

    await expect(search("")).resolves.toEqual(knownSources);
  });

  it("adds the sources the user already used, and no one else's", async () => {
    await withSource(sessionUser.id, "Berlin Tech Meetup");
    await withSource(otherUser, "Berlin Startup Jobs");

    await expect(search("berlin")).resolves.toEqual(["Berlin Tech Meetup"]);
  });

  it("searches nothing without a session", async () => {
    // requireUser() ends the request with a redirect, which Next.js delivers as a throw.
    const redirected = new Error(`redirected to ${signInPath()}`);
    vi.mocked(requireUser).mockRejectedValue(redirected);

    await expect(search("LinkedIn")).rejects.toBe(redirected);
    expect(applicationRepositoryForRequest).not.toHaveBeenCalled();
  });
});
