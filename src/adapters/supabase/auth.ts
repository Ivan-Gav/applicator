import {
  type AuthError,
  isAuthRetryableFetchError,
  type User as SupabaseUser,
} from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  type Authentication,
  AuthenticationStatus,
  MagicLinkRequestStatus,
  type MagicLinkRequestOutcome,
  SignInFailureReason,
} from "@/domain/user/model";
import { authCookiePrefix, callbackParam, supabaseErrorCode } from "./auth.constants";
import { createSupabaseServerClient } from "./client";
import { toUser } from "./user.mapper";

export type SignInCompletion = { ok: true } | { ok: false; reason: SignInFailureReason };

const succeeded: SignInCompletion = { ok: true };

function failed(reason: SignInFailureReason): SignInCompletion {
  return { ok: false, reason };
}

// "For security purposes, you can only request this after 42 seconds."
const retryAfterPattern = /after (\d+) seconds?/;

// Supabase issues auth codes as UUIDs. Anything else is refused before it
// costs a round trip.
const authCodePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function retryAfterSeconds(message: string): number | null {
  const match = retryAfterPattern.exec(message);
  return match?.[1] === undefined ? null : Number(match[1]);
}

export async function sendMagicLink(
  email: string,
  callbackUrl: string,
): Promise<MagicLinkRequestOutcome> {
  const supabase = await createSupabaseServerClient();
  let error: AuthError | null;
  try {
    ({ error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl },
    }));
  } catch {
    return { status: MagicLinkRequestStatus.Unavailable };
  }

  if (!error) {
    return { status: MagicLinkRequestStatus.Sent };
  }
  switch (error.code) {
    case supabaseErrorCode.overEmailSendRateLimit:
    case supabaseErrorCode.overRequestRateLimit:
      return {
        status: MagicLinkRequestStatus.RateLimited,
        retryAfterSeconds: retryAfterSeconds(error.message),
      };
    case supabaseErrorCode.emailAddressInvalid:
    case supabaseErrorCode.validationFailed:
      return { status: MagicLinkRequestStatus.InvalidEmail };
    default:
      return { status: MagicLinkRequestStatus.Unavailable };
  }
}

function failureReason(error: AuthError): SignInFailureReason {
  if (isAuthRetryableFetchError(error)) {
    return SignInFailureReason.Unavailable;
  }
  switch (error.code) {
    case supabaseErrorCode.pkceCodeVerifierNotFound:
      return SignInFailureReason.VerifierMissing;
    case supabaseErrorCode.otpExpired:
    case supabaseErrorCode.flowStateExpired:
      return SignInFailureReason.LinkExpired;
    default:
      return SignInFailureReason.LinkInvalid;
  }
}

/** PKCE: the link from the email carries a code; the verifier is in our cookie. */
async function exchangeCodeForSession(code: string): Promise<SignInCompletion> {
  const supabase = await createSupabaseServerClient();
  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error ? failed(failureReason(error)) : succeeded;
  } catch {
    return failed(SignInFailureReason.Unavailable);
  }
}

/**
 * Token-hash verification, the flow Supabase documents for server-side apps.
 * Needs no verifier cookie, so it also works for links minted by the admin API,
 * which is what the E2E suite relies on.
 */
async function verifyMagicLinkToken(tokenHash: string): Promise<SignInCompletion> {
  const supabase = await createSupabaseServerClient();
  try {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
    return error ? failed(failureReason(error)) : succeeded;
  } catch {
    return failed(SignInFailureReason.Unavailable);
  }
}

/**
 * Turns the query string Supabase sends to the magic link callback into a
 * session. Everything about the shape of that redirect is Supabase's contract,
 * which is why it is read here and not in the route handler.
 */
export async function completeSignInFromCallback(
  params: URLSearchParams,
): Promise<SignInCompletion> {
  // Supabase redirected with an error instead of a code: the link expired,
  // was used already (mail scanners open links on delivery) or was
  // superseded by a newer one.
  if (params.has(callbackParam.error)) {
    return failed(
      params.get(callbackParam.errorCode) === supabaseErrorCode.otpExpired
        ? SignInFailureReason.LinkExpired
        : SignInFailureReason.LinkInvalid,
    );
  }

  const code = params.get(callbackParam.code);
  if (code !== null) {
    return authCodePattern.test(code)
      ? exchangeCodeForSession(code)
      : failed(SignInFailureReason.LinkInvalid);
  }

  const tokenHash = params.get(callbackParam.tokenHash);
  if (tokenHash !== null) {
    return verifyMagicLinkToken(tokenHash);
  }

  return failed(SignInFailureReason.LinkInvalid);
}

const signedOut: Authentication = { status: AuthenticationStatus.SignedOut };
const unavailable: Authentication = { status: AuthenticationStatus.Unavailable };

/**
 * The signed-in user, verified with Supabase. This is the only server-side
 * identity check: getUser() sends the token to the Auth server, whereas
 * getSession() would merely decode a cookie anyone can forge.
 */
export async function authenticate(): Promise<Authentication> {
  const supabase = await createSupabaseServerClient();
  let data: { user: SupabaseUser | null };
  let error: AuthError | null;
  try {
    ({ data, error } = await supabase.auth.getUser());
  } catch {
    return unavailable;
  }

  if (error) {
    return isAuthRetryableFetchError(error) ? unavailable : signedOut;
  }
  return data.user ? { status: AuthenticationStatus.SignedIn, user: toUser(data.user) } : signedOut;
}

export async function signOutCurrentSession(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  try {
    // The default scope is "global", which revokes the user's sessions on
    // every device. Someone pressing "sign out" on one laptop expects only
    // that laptop to be signed out.
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Supabase unreachable: the cookies are removed below regardless, which
    // ends the session as far as this browser is concerned.
  }

  const cookieStore = await cookies();
  for (const { name } of cookieStore.getAll()) {
    if (name.startsWith(authCookiePrefix)) {
      cookieStore.delete(name);
    }
  }
}
