import { cache } from "react";
import { authenticate } from "@/adapters/supabase/auth";
import { AuthenticationStatus, type User } from "@/domain/user/model";
import { AuthUnavailableError } from "./auth-unavailable-error";

const authentication = cache(authenticate);

/**
 * The signed-in user, or null. Cached per request, so layout and page share
 * one call. Reads only; requireUser() decides on access.
 *
 * Throws AuthUnavailableError when Supabase cannot be reached.
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

/** currentUser() for public pages: null when Supabase cannot be reached. */
export async function currentUserIfReachable(): Promise<User | null> {
  const result = await authentication();
  return result.status === AuthenticationStatus.SignedIn ? result.user : null;
}
