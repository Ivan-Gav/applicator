import { cache } from "react";
import { authenticate } from "@/adapters/supabase/auth";
import { AuthenticationStatus, type User } from "@/domain/user/model";
import { AuthUnavailableError } from "./auth-unavailable-error";

const authentication = cache(authenticate);

/**
 * Reads the signed-in user, or null. Cached per request with React's cache,
 * so the protected layout deciding on access and a page reading the user
 * inside the same request share one verification call to Supabase.
 *
 * Reading only: a page that needs the user calls this and handles null.
 * Deciding on access is requireUser().
 *
 * Throws AuthUnavailableError when Supabase cannot be reached, since null
 * would claim the user is signed out.
 */
export async function currentUser(): Promise<User | null> {
  const result = await authentication();
  switch (result.status) {
    case AuthenticationStatus.SignedIn:
      return result.user;
    case AuthenticationStatus.SignedOut:
      return null;
    case AuthenticationStatus.Unavailable:
      throw new AuthUnavailableError();
  }
}
