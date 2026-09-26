import { Button } from "@/ui/kit/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/kit/card";
import { messages } from "@/ui/messages";

export type ErrorScreenProps = {
  // An outage of the identity provider, which says nothing about the session:
  // the user is told they are still signed in rather than that something broke.
  authUnavailable: boolean;
  retry: () => void;
};

const t = messages.error;

export function ErrorScreen({ authUnavailable, retry }: ErrorScreenProps) {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl font-semibold tracking-tight">
              {authUnavailable ? t.authUnavailableTitle : t.title}
            </h1>
          </CardTitle>
          <CardDescription>
            {authUnavailable ? t.authUnavailableDescription : t.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" onClick={retry}>
            {t.retry}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
