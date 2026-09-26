export type User = {
  id: string;
  email: string;
  createdAt: Date;
};

// Why a sign-in attempt did not end in a session. The values travel in the
// sign-in URL, so they are stable identifiers, not display text.
export const SignInFailureReason = {
  LinkExpired: "link_expired",
  LinkInvalid: "link_invalid",
  VerifierMissing: "verifier_missing",
  SessionExpired: "session_expired",
  Unavailable: "unavailable",
} as const;
export type SignInFailureReason = (typeof SignInFailureReason)[keyof typeof SignInFailureReason];

export const signInFailureReasons: readonly SignInFailureReason[] =
  Object.values(SignInFailureReason);

export function isSignInFailureReason(value: unknown): value is SignInFailureReason {
  return typeof value === "string" && (signInFailureReasons as readonly string[]).includes(value);
}

// What the proxy finds on an incoming request. Expired means a session was
// there but was refused renewal, as opposed to never having been there.
// Unavailable means renewal could not be attempted at all: the session may be
// perfectly valid, so it must survive until the identity provider is back.
export const SessionState = {
  Active: "active",
  Missing: "missing",
  Expired: "expired",
  Unavailable: "unavailable",
} as const;
export type SessionState = (typeof SessionState)[keyof typeof SessionState];

// The answer to "who is signed in?". Unavailable is not SignedOut: treating
// an outage as signed out would send a signed-in user to the sign-in form.
export const AuthenticationStatus = {
  SignedIn: "signed_in",
  SignedOut: "signed_out",
  Unavailable: "unavailable",
} as const;

export type Authentication =
  | { status: typeof AuthenticationStatus.SignedIn; user: User }
  | { status: typeof AuthenticationStatus.SignedOut }
  | { status: typeof AuthenticationStatus.Unavailable };

export const MagicLinkRequestStatus = {
  Sent: "sent",
  InvalidEmail: "invalid_email",
  RateLimited: "rate_limited",
  Unavailable: "unavailable",
} as const;

export type MagicLinkRequestOutcome =
  | { status: typeof MagicLinkRequestStatus.Sent }
  | { status: typeof MagicLinkRequestStatus.InvalidEmail }
  | { status: typeof MagicLinkRequestStatus.RateLimited; retryAfterSeconds: number | null }
  | { status: typeof MagicLinkRequestStatus.Unavailable };
