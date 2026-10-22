import type { ReactNode } from "react";
import { signOut } from "@/app/auth/actions";
import { requireUser } from "@/app/auth/_utils/require-user";
import { placeDataSource, routes, sourceRepositoryUrl } from "@/app/routes";
import { messages } from "@/ui/messages";
import { AppFooter } from "@/ui/shell/AppFooter";
import { AppHeader } from "@/ui/shell/AppHeader";

const navItems = [
  { href: routes.applications, label: messages.nav.applications },
  { href: routes.documents, label: messages.nav.documents },
];

// Protects every page in this group. Route handlers and server actions are not
// covered and call requireUser() themselves.
export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return (
    <>
      <AppHeader homeHref={routes.home} navItems={navItems} email={user.email} signOut={signOut} />
      <main className="flex flex-1 flex-col pt-7 pb-18">{children}</main>
      <AppFooter sourceHref={sourceRepositoryUrl} placeData={placeDataSource} />
    </>
  );
}
