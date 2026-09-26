import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionState } from "@/domain/user/model";
import {
  accessTokenIn,
  fakeAnonKey,
  fakeSupabaseUrl,
  requestWith,
  requestWithSession,
  rotated,
  sessionCookie,
  stored,
  tokenRefresh,
} from "./proxy-session.fixtures";
import { resolveSession } from "./proxy-session";

const server = setupServer();
const refreshCalls = vi.fn();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", fakeSupabaseUrl);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", fakeAnonKey);
});
afterEach(() => {
  server.resetHandlers();
  refreshCalls.mockReset();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
afterAll(() => server.close());

describe("resolveSession", () => {
  it("reports a missing session when there is no session cookie", async () => {
    const result = await resolveSession(requestWith({ theme: "dark" }));

    expect(result.state).toBe(SessionState.Missing);
    expect(refreshCalls).not.toHaveBeenCalled();
  });

  it("passes a fresh session through without contacting Supabase", async () => {
    server.use(tokenRefresh.succeeds(refreshCalls));

    const result = await resolveSession(requestWithSession(3600));

    expect(result.state).toBe(SessionState.Active);
    expect(refreshCalls).not.toHaveBeenCalled();
    expect(result.forward().cookies.getAll()).toEqual([]);
  });

  it("rotates a session close to expiry exactly once, for the route and the browser", async () => {
    server.use(tokenRefresh.succeeds(refreshCalls));
    const request = requestWithSession(30);

    const result = await resolveSession(request);
    const response = result.forward();

    expect(result.state).toBe(SessionState.Active);
    expect(refreshCalls).toHaveBeenCalledOnce();
    expect(accessTokenIn(request.cookies.get(sessionCookie)?.value)).toBe(rotated.accessToken);
    expect(accessTokenIn(response.cookies.get(sessionCookie)?.value)).toBe(rotated.accessToken);
  });

  it("keeps a CDN from caching the response that carries rotated tokens", async () => {
    server.use(tokenRefresh.succeeds(refreshCalls));

    const response = (await resolveSession(requestWithSession(30))).forward();

    expect(response.headers.get("cache-control")).toMatch(/no-store/);
  });

  it("reports an expired session and clears it when Supabase rejects the refresh", async () => {
    server.use(tokenRefresh.isRejected(refreshCalls));
    const request = requestWithSession(-60);

    const result = await resolveSession(request);
    const response = result.forward();

    expect(result.state).toBe(SessionState.Expired);
    expect(refreshCalls).toHaveBeenCalledOnce();
    expect(request.cookies.get(sessionCookie)?.value).toBeFalsy();
    expect(response.cookies.get(sessionCookie)).toMatchObject({ value: "", maxAge: 0 });
  });

  it("keeps the session untouched when Supabase cannot be reached", async () => {
    // The SDK retries a failed connection with backoff for up to 30 seconds.
    vi.useFakeTimers();
    server.use(tokenRefresh.cannotConnect(refreshCalls));
    const request = requestWithSession(-60);
    const cookieBefore = request.cookies.get(sessionCookie)?.value;

    const pending = resolveSession(request);
    await vi.runAllTimersAsync();
    const result = await pending;

    expect(result.state).toBe(SessionState.Unavailable);
    expect(refreshCalls).toHaveBeenCalled();
    expect(request.cookies.get(sessionCookie)?.value).toBe(cookieBefore);
    expect(accessTokenIn(cookieBefore)).toBe(stored.accessToken);
    expect(result.forward().cookies.getAll()).toEqual([]);
  });
});
