import Link from "next/link";
import { currentUserIfReachable } from "@/app/auth/_utils/current-user";
import { routes, signInPath, sourceRepositoryUrl } from "@/app/routes";
import { Button } from "@/ui/kit/button";
import { messages } from "@/ui/messages";

const t = messages.home;

// Public in both states: a signed-in visitor is offered the app, not sent to it.
export default async function Home() {
  const user = await currentUserIfReachable();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">{messages.app.name}</h1>
      <p className="max-w-prose text-muted-foreground">{t.summary}</p>
      <div className="flex flex-wrap justify-center gap-3">
        {user ? (
          <Button asChild>
            <Link href={routes.applications}>{t.openApplications}</Link>
          </Button>
        ) : (
          <Button asChild>
            <Link href={signInPath()}>{t.signIn}</Link>
          </Button>
        )}
        {/* A second action (demo account) goes here, beside the primary one. */}
      </div>
      <a href={sourceRepositoryUrl} className="text-sm underline underline-offset-4">
        {t.sourceCode}
      </a>
    </main>
  );
}
