import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationStatus } from "@/domain/user/model";
import { authenticate } from "./auth";
import { supabaseErrorCode } from "./auth.constants";
import {
  fakeAnonKey,
  fakeSupabaseUrl,
  requestWith,
  requestWithSession,
  supabaseUser,
  userEndpoint,
} from "./proxy-session.fixtures";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

// The request's own cookie jar stands in for the one Next.js hands a route.
function withCookiesOf(request: NextRequest) {
  vi.mocked(cookies).mockResolvedValue(
    request.cookies as unknown as Awaited<ReturnType<typeof cookies>>,
  );
}

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", fakeSupabaseUrl);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", fakeAnonKey);
});
afterEach(() => {
  server.resetHandlers();
  vi.unstubAllEnvs();
});
afterAll(() => server.close());

describe("authenticate", () => {
  it("reports signed out without asking Supabase when there is no session", async () => {
    withCookiesOf(requestWith());

    expect(await authenticate()).toEqual({ status: AuthenticationStatus.SignedOut });
  });

  it("returns the user Supabase vouches for", async () => {
    server.use(http.get(userEndpoint, () => HttpResponse.json(supabaseUser)));
    withCookiesOf(requestWithSession(3600));

    expect(await authenticate()).toEqual({
      status: AuthenticationStatus.SignedIn,
      user: {
        id: supabaseUser.id,
        email: supabaseUser.email,
        createdAt: new Date(supabaseUser.created_at),
      },
    });
  });

  it("reports signed out when Supabase rejects the token", async () => {
    server.use(
      http.get(userEndpoint, () =>
        HttpResponse.json({ code: 403, error_code: supabaseErrorCode.badJwt }, { status: 403 }),
      ),
    );
    withCookiesOf(requestWithSession(3600));

    expect(await authenticate()).toEqual({ status: AuthenticationStatus.SignedOut });
  });

  it("reports unavailable, not signed out, when Supabase cannot be reached", async () => {
    server.use(http.get(userEndpoint, () => HttpResponse.error()));
    withCookiesOf(requestWithSession(3600));

    expect(await authenticate()).toEqual({ status: AuthenticationStatus.Unavailable });
  });
});
