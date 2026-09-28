import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";

// httpOnly is safe: there is no browser client to read these cookies.
export const authCookieOptions: CookieOptions = {
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};

/** Carries the user's access token, so RLS applies. One per request; never shared. */
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
          // Server Components cannot write cookies; the proxy has already written the refreshed ones.
        }
      },
    },
  });
}
