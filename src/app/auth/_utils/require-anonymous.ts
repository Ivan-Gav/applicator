import { redirect } from "next/navigation";
import { afterSignInPath, redirectToIn } from "@/app/routes";
import { currentUserIfReachable } from "./current-user";
import { requestedPath } from "./requested-path";

/**
 * Sends a signed-in user where sign-in would have taken them, honouring
 * `redirectTo`. Anyone else passes, including when Supabase is unreachable.
 */
export async function requireAnonymous(): Promise<void> {
  if (await currentUserIfReachable()) {
    const path = await requestedPath();
    redirect(afterSignInPath(path && redirectToIn(path)));
  }
}
