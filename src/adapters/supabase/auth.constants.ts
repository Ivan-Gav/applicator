// Values defined by Supabase, not by this app. Kept free of runtime imports so
// the E2E helpers can use them without loading Next.js server modules.

// @supabase/ssr names its cookies `sb-...`
export const authCookiePrefix = "sb-";
const sessionCookieSuffix = "-auth-token";
// Marks a session cookie value as base64url-encoded JSON.
export const sessionCookieEncodingPrefix = "base64-";

/** The session cookie name @supabase/ssr derives from the project URL. */
export function sessionCookieName(supabaseUrl: string): string {
  const projectLabel = new URL(supabaseUrl).hostname.split(".")[0];
  return `${authCookiePrefix}${projectLabel}${sessionCookieSuffix}`;
}

export const authOtpPath = "/auth/v1/otp";
export const authTokenPath = "/auth/v1/token";
export const authUserPath = "/auth/v1/user";

// Query parameters Supabase appends when it redirects to the magic link callback.
export const callbackParam = {
  code: "code",
  tokenHash: "token_hash",
  error: "error",
  errorCode: "error_code",
  errorDescription: "error_description",
} as const;

// https://supabase.com/docs/guides/auth/debugging/error-codes
export const supabaseErrorCode = {
  overEmailSendRateLimit: "over_email_send_rate_limit",
  overRequestRateLimit: "over_request_rate_limit",
  emailAddressInvalid: "email_address_invalid",
  validationFailed: "validation_failed",
  pkceCodeVerifierNotFound: "pkce_code_verifier_not_found",
  otpExpired: "otp_expired",
  flowStateExpired: "flow_state_expired",
  flowStateNotFound: "flow_state_not_found",
  refreshTokenNotFound: "refresh_token_not_found",
  badJwt: "bad_jwt",
} as const;
