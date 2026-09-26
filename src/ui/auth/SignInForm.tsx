"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { MagicLinkRequestStatus, type MagicLinkRequestOutcome } from "@/domain/user/model";
import { type SignInInput, signInSchema } from "@/domain/user/schema";
import { Alert, AlertDescription, AlertTitle } from "@/ui/kit/alert";
import { Button } from "@/ui/kit/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/kit/card";
import { Field, FieldError, FieldLabel } from "@/ui/kit/field";
import { Input } from "@/ui/kit/input";
import { messages } from "@/ui/messages";
import { magicLinkOutcomeMessage } from "./sign-in-messages";

export type SignInFormProps = {
  requestMagicLink: (input: SignInInput) => Promise<MagicLinkRequestOutcome>;
  // Why the previous attempt failed, already turned into a sentence; null on a
  // plain visit.
  failureMessage: string | null;
};

const t = messages.signIn;

type View = { kind: "form" } | { kind: "sent"; email: string; resent: boolean };

export function SignInForm({ requestMagicLink, failureMessage }: SignInFormProps) {
  const [view, setView] = useState<View>({ kind: "form" });
  const [notice, setNotice] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "" },
  });
  const emailError = form.formState.errors.email;

  async function send(email: string): Promise<boolean> {
    setNotice(null);
    const outcome = await requestMagicLink({ email });
    if (outcome.status === MagicLinkRequestStatus.Sent) {
      return true;
    }
    setNotice(magicLinkOutcomeMessage(outcome));
    return false;
  }

  const submit = form.handleSubmit(async ({ email }) => {
    if (await send(email)) {
      setView({ kind: "sent", email, resent: false });
    }
  });

  async function resend(email: string) {
    setResending(true);
    try {
      if (await send(email)) {
        setView({ kind: "sent", email, resent: true });
      }
    } finally {
      setResending(false);
    }
  }

  function editAddress(email: string) {
    setNotice(null);
    form.reset({ email });
    setView({ kind: "form" });
  }

  if (view.kind === "sent") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl font-semibold tracking-tight">{t.inbox.title}</h1>
          </CardTitle>
          <CardDescription>
            {t.inbox.sentToBefore} <strong className="text-foreground">{view.email}</strong>
            {t.inbox.sentToAfter} {t.inbox.hint}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {view.resent && <p role="status">{t.inbox.resent}</p>}
          {notice && (
            <Alert variant="destructive">
              <AlertDescription>
                <p className="text-foreground">{notice}</p>
              </AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={resending} onClick={() => void resend(view.email)}>
              {resending ? t.sending : t.inbox.sendAgain}
            </Button>
            <Button type="button" variant="outline" onClick={() => editAddress(view.email)}>
              {t.inbox.useDifferentAddress}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        </CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {failureMessage && (
          <Alert variant="destructive" className="mb-4" aria-labelledby="sign-in-failure-title">
            <AlertTitle id="sign-in-failure-title">{t.failureTitle}</AlertTitle>
            <AlertDescription>
              {/* The variant's red-at-90% description fails AA contrast; keep the body readable. */}
              <p className="text-foreground">{failureMessage}</p>
            </AlertDescription>
          </Alert>
        )}
        <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
          <Field data-invalid={emailError ? true : undefined}>
            <FieldLabel htmlFor="email">{t.emailLabel}</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? "email-error" : undefined}
              {...form.register("email")}
            />
            <FieldError id="email-error" errors={emailError ? [{ message: t.invalidEmail }] : []} />
          </Field>
          {notice && (
            <Alert variant="destructive">
              <AlertDescription>
                <p className="text-foreground">{notice}</p>
              </AlertDescription>
            </Alert>
          )}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? t.sending : t.submit}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
