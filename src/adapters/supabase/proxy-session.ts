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
  // A network failure is no verdict on the session. The SDK keeps the cookies
  // in that case and so does the proxy: the session resumes by itself once
  // Supabase answers again. Any other error is a refusal, and the SDK has
  // already cleared the dead session through setAll.
  return isAuthRetryableFetchError(error) ? SessionState.Unavailable : SessionState.Expired;
}

/**
 * Loads the session from the request cookies, rotating the tokens on the way
 * when they are close to expiry, following the Supabase SSR guide for Next.js.
 */
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
        // Cache-control headers that keep a CDN from serving one user's
        // session cookies to another.
        Object.assign(responseHeaders, headers);
      },
    },
  });

  // Whether a refresh is due is left to the SDK: getSession() reads the cookie
  // locally and refreshes only inside the SDK's own expiry margin. A margin of
  // ours would have to track that one, and the server client applies the same
  // margin inside getUser(), where it cannot write cookies. Letting the SDK
  // decide here guarantees the page never finds the token due after the proxy.
  // The session is checked for presence only: it is unverified, never identity.
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
