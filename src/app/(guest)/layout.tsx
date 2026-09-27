import type { ReactNode } from "react";
import { requireAnonymous } from "@/app/auth/_utils/require-anonymous";

// The mirror of (protected): pages for visitors without a session. A signed-in
// user is sent on to the app. The magic link callback stays outside this group
// because it must also run for a session that already exists.
export default async function GuestLayout({ children }: { children: ReactNode }) {
  await requireAnonymous();

  return children;
}
