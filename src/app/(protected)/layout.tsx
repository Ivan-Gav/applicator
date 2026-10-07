import type { ReactNode } from "react";
import { signOut } from "@/app/auth/actions";
import { requireUser } from "@/app/auth/_utils/require-user";
import { routes, sourceRepositoryUrl } from "@/app/routes";
import { messages } from "@/ui/messages";
import { AppFooter } from "@/ui/shell/AppFooter";
import { AppHeader } from "@/ui/shell/AppHeader";

const navItems = [{ href: routes.applications, label: messages.nav.applications }];

// Protects every page in this group. Route handlers and server actions are not
// covered and call requireUser() themselves.
export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return (
    <>
      <AppHeader homeHref={routes.home} navItems={navItems} email={user.email} signOut={signOut} />
      <main className="flex flex-1 flex-col pt-6 pb-24">{children}</main>
      <AppFooter sourceHref={sourceRepositoryUrl} />
    </>
  );
}
