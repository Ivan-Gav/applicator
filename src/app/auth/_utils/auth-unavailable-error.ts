// In production Next.js strips a server error's message before the error
// boundary, but passes its digest through unchanged.
export const authUnavailableDigest = "AUTH_UNAVAILABLE";

/**
 * Supabase could not be asked who is signed in; the session cookies stay
 * untouched. Must stay free of imports: the client-side error boundary imports it.
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
