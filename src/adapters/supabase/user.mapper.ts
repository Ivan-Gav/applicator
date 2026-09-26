import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { User } from "@/domain/user/model";

export function toUser(row: SupabaseUser): User {
  if (!row.email) {
    // Email is the only way to sign in here, so a user without one cannot exist.
    throw new Error(`Supabase user ${row.id} has no email address`);
  }
  return {
    id: row.id,
    email: row.email,
    createdAt: new Date(row.created_at),
  };
}
