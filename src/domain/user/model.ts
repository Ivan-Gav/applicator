export type User = {
  id: string;
  email: string;
  createdAt: Date;
};

// The values travel in the sign-in URL: stable identifiers, not display text.
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

// What the proxy finds on a request. Expired: renewal was refused.
// Unavailable: renewal could not be attempted; the session may still be valid.
export const SessionState = {
  Active: "active",
  Missing: "missing",
  Expired: "expired",
  Unavailable: "unavailable",
} as const;
export type SessionState = (typeof SessionState)[keyof typeof SessionState];

// Unavailable is not SignedOut: the session may still be valid.
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
