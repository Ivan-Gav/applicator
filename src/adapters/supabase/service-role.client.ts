/**
 * SERVICE ROLE CLIENT: BYPASSES ROW LEVEL SECURITY.
 *
 * Used by the Playwright setup to mint magic links without a mailbox, and by
 * nothing else. No runtime application code may import this module; ESLint
 * refuses the import outside e2e/. Serving a user request with this client
 * would hand every user every other user's data.
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
