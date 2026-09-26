import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";

// Nothing in the browser reads these cookies (there is no browser client), so
// both the session and the PKCE code verifier can stay out of reach of scripts.
export const authCookieOptions: CookieOptions = {
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};

/**
 * A client bound to the cookies of the current request. It carries the user's
 * access token, so RLS applies to every query it makes. Create one per request;
 * never share it across requests.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. Reaching this branch is
          // harmless: the proxy already refreshed the session on the way in and
          // wrote the new cookies onto its own response.
        }
      },
    },
  });
}
