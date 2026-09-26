import { setupServer } from "msw/node";
import type { NextResponse } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fakeAnonKey,
  fakeSupabaseUrl,
  requestWith,
  requestWithSession,
  tokenRefresh,
} from "@/adapters/supabase/proxy-session.fixtures";
import { signInReasonHeader } from "@/app/routes";
import { SignInFailureReason } from "@/domain/user/model";
import { proxy } from "./proxy";

// How NextResponse.next({ request }) hands the rewritten request headers to
// the route: each one mirrored under this prefix on the proxy's response.
function forwardedRequestHeader(response: NextResponse, name: string): string | null {
  return response.headers.get(`x-middleware-request-${name}`);
}

const server = setupServer();
const noop = () => {};

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

describe("proxy", () => {
  it("passes a request without a session on instead of redirecting it", async () => {
    const response = await proxy(requestWith());

    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
  });

  it("tells requireUser() that the session expired", async () => {
    server.use(tokenRefresh.isRejected(noop));

    const response = await proxy(requestWithSession(-60));

    expect(response.headers.get("location")).toBeNull();
    expect(forwardedRequestHeader(response, signInReasonHeader)).toBe(
      SignInFailureReason.SessionExpired,
    );
  });

  it("drops a sign-in reason sent by the client", async () => {
    const response = await proxy(
      requestWith({}, { [signInReasonHeader]: SignInFailureReason.SessionExpired }),
    );

    expect(forwardedRequestHeader(response, signInReasonHeader)).toBeNull();
  });

  it("gives no reason for a live session", async () => {
    const response = await proxy(
      requestWithSession(3600, { [signInReasonHeader]: SignInFailureReason.SessionExpired }),
    );

    expect(forwardedRequestHeader(response, signInReasonHeader)).toBeNull();
  });
});
