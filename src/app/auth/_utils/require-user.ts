import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signInPath, signInReasonHeader } from "@/app/routes";
import { isSignInFailureReason, type User } from "@/domain/user/model";
import { currentUser } from "./current-user";

/**
 * Decides on access. Verifies the token with Supabase (getUser, never
 * getSession) and redirects to /sign-in when there is no valid session,
 * saying why when the proxy found one that had expired.
 *
 * Called in exactly two kinds of places:
 *   - the (protected) route group's layout, once, covering every page in it
 *   - the first statement of every route handler and server action, because
 *     no layout runs for those: they are independent HTTP entry points
 *
 * Throws AuthUnavailableError when Supabase cannot be reached.
 */
export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) {
    const reason = (await headers()).get(signInReasonHeader);
    redirect(signInPath(isSignInFailureReason(reason) ? reason : undefined));
  }
  return user;
}
