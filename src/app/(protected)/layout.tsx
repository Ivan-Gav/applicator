import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/auth/actions";
import { requireUser } from "@/app/auth/_utils/require-user";
import { routes } from "@/app/routes";
import { Button } from "@/ui/kit/button";
import { messages } from "@/ui/messages";

// The one place pages are protected: everything under (protected) is covered
// by living here, and pages carry no check of their own. Route handlers and
// server actions are not covered by any layout and call requireUser() themselves.
export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return (
    <>
      <header className="flex items-center justify-between border-b px-6 py-3">
        <Link href={routes.applications} className="font-semibold tracking-tight">
          {messages.app.name}
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{user.email}</span>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              {messages.nav.signOut}
            </Button>
          </form>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-6 p-6">{children}</main>
    </>
  );
}
