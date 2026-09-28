/**
 * SERVICE ROLE CLIENT: BYPASSES ROW LEVEL SECURITY.
 * For e2e/ only (enforced by ESLint); must never serve a user request.
 */
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

export function createServiceRoleClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set; it is needed for the E2E setup only.");
  }
  return createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
