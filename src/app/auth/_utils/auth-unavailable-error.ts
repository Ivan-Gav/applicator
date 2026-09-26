// Next.js strips the message of a server error before it reaches the error
// boundary in production, but passes an existing digest through unchanged.
// The digest is therefore the one thing the boundary can recognise this by.
export const authUnavailableDigest = "AUTH_UNAVAILABLE";

/**
 * Supabase could not be asked who is signed in. Thrown rather than treated as
 * signed out, which would send a signed-in user to the sign-in form and, on a
 * page, lose the page they were on. The session cookies stay untouched.
 *
 * Free of imports on purpose: the client-side error boundary imports it.
 */
export class AuthUnavailableError extends Error {
  readonly digest = authUnavailableDigest;

  constructor() {
    super("Supabase Auth is unreachable; the session could not be verified");
    this.name = "AuthUnavailableError";
  }
}

export function isAuthUnavailable(error: { digest?: string }): boolean {
  return error.digest === authUnavailableDigest;
}
