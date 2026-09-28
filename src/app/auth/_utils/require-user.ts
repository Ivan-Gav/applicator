import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signInPath, signInReasonHeader } from "@/app/routes";
import { isSignInFailureReason, type User } from "@/domain/user/model";
import { currentUser } from "./current-user";
import { requestedPath } from "./requested-path";

/**
 * Decides on access: redirects to sign-in without a valid session, carrying
 * the requested path and, if the proxy found one, the reason.
 *
 * Throws AuthUnavailableError when Supabase cannot be reached.
 */
export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) {
    const reason = (await headers()).get(signInReasonHeader);
    redirect(
      signInPath({
        reason: isSignInFailureReason(reason) ? reason : undefined,
        redirectTo: await requestedPath(),
      }),
    );
  }
  return user;
}
