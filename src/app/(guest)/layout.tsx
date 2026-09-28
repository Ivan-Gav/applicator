import type { ReactNode } from "react";
import { requireAnonymous } from "@/app/auth/_utils/require-anonymous";

// The magic link callback stays outside: it must also run with a session.
export default async function GuestLayout({ children }: { children: ReactNode }) {
  await requireAnonymous();

  return children;
}
