import type { BrowserContext } from "@playwright/test";
import { sessionCookieEncodingPrefix, sessionCookieName } from "@/adapters/supabase/auth.constants";

const base64url = (value: string) => Buffer.from(value, "utf8").toString("base64url");

/**
 * Plants a session cookie Supabase never issued: shaped like a real one, with
 * a forged signature and a refresh token Supabase does not know. With a
 * future expiry the proxy passes it on untouched, since it never verifies a
 * token; with a past one the proxy tries to refresh it and Supabase refuses.
 */
export async function plantForgedSession(
  context: BrowserContext,
  baseURL: string | undefined,
  expiresInSeconds: number,
): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const forgedToken = `${base64url('{"alg":"HS256","typ":"JWT"}')}.${base64url(
    JSON.stringify({ sub: "00000000-0000-4000-8000-000000000000", role: "authenticated", exp }),
  )}.forged-signature`;
  const session = { access_token: forgedToken, refresh_token: "forged", expires_at: exp };

  await context.addCookies([
    {
      name: forgedSessionCookieName(),
      value: `${sessionCookieEncodingPrefix}${base64url(JSON.stringify(session))}`,
      url: baseURL ?? "http://localhost:3000",
    },
  ]);
}

export function forgedSessionCookieName(): string {
  return sessionCookieName(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
}
