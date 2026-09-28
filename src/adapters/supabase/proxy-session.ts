import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { type AuthError, isAuthRetryableFetchError } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { SessionState } from "@/domain/user/model";
import { authCookieOptions } from "./client";
import type { Database } from "./database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";

export type ProxySession = {
  state: SessionState;
  /**
   * Passes the request on with any rotated or cleared cookies. Call it last:
   * Next.js forwards the request headers as they are at that moment, so
   * anything set on the request afterwards never reaches the route.
   */
  forward(): NextResponse;
};

type CookiesToSet = Parameters<SetAllCookies>[0];
type ResponseHeaders = Parameters<SetAllCookies>[1];

function stateOf(hasSession: boolean, error: AuthError | null): SessionState {
  if (!error) {
    return hasSession ? SessionState.Active : SessionState.Missing;
  }
  // On a network failure the SDK keeps the cookies. Any other error is a
  // refusal, and the SDK has already cleared the session through setAll.
  return isAuthRetryableFetchError(error) ? SessionState.Unavailable : SessionState.Expired;
}

/** Loads the session from the request cookies, rotating the tokens when they are close to expiry. */
export async function resolveSession(request: NextRequest): Promise<ProxySession> {
  const cookiesToSet: CookiesToSet = [];
  const responseHeaders: ResponseHeaders = {};

  const supabase = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies, headers) {
        // Onto the request now, so the route rendered after the proxy sees the
        // new tokens; onto the response in forward(), so the browser stores them.
        for (const { name, value } of cookies) {
          request.cookies.set(name, value);
        }
        cookiesToSet.push(...cookies);
        // Cache-control headers that keep a CDN from sharing session cookies.
        Object.assign(responseHeaders, headers);
      },
    },
  });

  // getSession() refreshes within the same expiry margin getUser() uses, so the
  // page never finds a token due after the proxy. The result is unverified:
  // checked for presence only, never used as identity.
  const { data, error } = await supabase.auth.getSession();

  return {
    state: stateOf(data.session !== null, error),
    forward() {
      const response = NextResponse.next({ request });
      for (const { name, value, options } of cookiesToSet) {
        response.cookies.set(name, value, options);
      }
      for (const [name, value] of Object.entries(responseHeaders)) {
        response.headers.set(name, value);
      }
      return response;
    },
  };
}
