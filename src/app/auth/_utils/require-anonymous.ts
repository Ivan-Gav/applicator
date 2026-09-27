import { redirect } from "next/navigation";
import { afterSignInPath, redirectToIn } from "@/app/routes";
import { currentUserIfReachable } from "./current-user";
import { requestedPath } from "./requested-path";

/**
 * The mirror of requireUser(), for the (guest) route group's layout: sends a
 * signed-in user where sign-in would have taken them, honouring `redirectTo`
 * in the requested URL. Anyone else passes.
 *
 * With Supabase unreachable the page renders: a guest page has nothing to
 * protect, and the sign-in form reports the outage itself when used.
 */
export async function requireAnonymous(): Promise<void> {
  if (await currentUserIfReachable()) {
    const path = await requestedPath();
    redirect(afterSignInPath(path && redirectToIn(path)));
  }
}
