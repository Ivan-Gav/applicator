// Test support for the proxy: a Supabase Auth token endpoint faked with MSW,
// and requests carrying session cookies shaped the way @supabase/ssr writes
// them. Lives here because only this directory may import @supabase/ssr.
import { stringFromBase64URL, stringToBase64URL } from "@supabase/ssr";
import { HttpResponse, http } from "msw";
import { NextRequest } from "next/server";
import { routes } from "@/app/routes";
import {
  authTokenPath,
  sessionCookieEncodingPrefix,
  sessionCookieName,
  supabaseErrorCode,
} from "./auth.constants";

// Never contacted: MSW answers every request, and fails the test on any other.
export const fakeSupabaseUrl = "http://127.0.0.1:54321";
export const fakeAnonKey = "anon-key";
const appOrigin = "http://localhost:3000";

export const sessionCookie = sessionCookieName(fakeSupabaseUrl);
const tokenEndpoint = new URL(authTokenPath, fakeSupabaseUrl).href;

const user = { id: "00000000-0000-4000-8000-000000000000", aud: "authenticated" };
export const stored = { accessToken: "stored-access", refreshToken: "stored-refresh" };
export const rotated = { accessToken: "rotated-access", refreshToken: "rotated-refresh" };

function session(tokens: typeof stored, secondsLeft: number) {
  return {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    token_type: "bearer",
    expires_in: secondsLeft,
    expires_at: Math.floor(Date.now() / 1000) + secondsLeft,
    user,
  };
}

export function requestWith(
  cookies: Record<string, string> = {},
  headers: Record<string, string> = {},
): NextRequest {
  const cookie = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  return new NextRequest(new URL(routes.applications, appOrigin), {
    headers: { ...headers, cookie },
  });
}

/** A request whose access token expires in `secondsLeft` (negative: already expired). */
export function requestWithSession(
  secondsLeft: number,
  headers: Record<string, string> = {},
): NextRequest {
  const value = JSON.stringify(session(stored, secondsLeft));
  return requestWith(
    { [sessionCookie]: `${sessionCookieEncodingPrefix}${stringToBase64URL(value)}` },
    headers,
  );
}

/** The access token inside a session cookie value, or undefined when there is none. */
export function accessTokenIn(cookieValue: string | undefined): string | undefined {
  if (!cookieValue) {
    return undefined;
  }
  const decoded: unknown = JSON.parse(
    stringFromBase64URL(cookieValue.slice(sessionCookieEncodingPrefix.length)),
  );
  return (decoded as { access_token: string }).access_token;
}

/** MSW handlers for the refresh request, each reporting its calls to `onCall`. */
export const tokenRefresh = {
  succeeds: (onCall: () => void) =>
    http.post(tokenEndpoint, () => {
      onCall();
      return HttpResponse.json(session(rotated, 3600));
    }),
  isRejected: (onCall: () => void) =>
    http.post(tokenEndpoint, () => {
      onCall();
      return HttpResponse.json(
        { code: 400, error_code: supabaseErrorCode.refreshTokenNotFound },
        { status: 400 },
      );
    }),
  cannotConnect: (onCall: () => void) =>
    http.post(tokenEndpoint, () => {
      onCall();
      return HttpResponse.error();
    }),
};
