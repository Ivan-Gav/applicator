import type { Metadata } from "next";
import { requestMagicLink } from "@/app/auth/actions";
import { signInSearchParam } from "@/app/routes";
import { isSignInFailureReason } from "@/domain/user/model";
import { sameSitePath } from "@/lib/same-site-path";
import { SignInForm } from "@/ui/auth/SignInForm";
import { signInFailureMessage } from "@/ui/auth/sign-in-messages";
import { messages } from "@/ui/messages";

export const metadata: Metadata = {
  title: messages.signIn.title,
};

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const reason = params[signInSearchParam.reason];
  const failureMessage = isSignInFailureReason(reason) ? signInFailureMessage(reason) : null;
  const redirectTo = sameSitePath(params[signInSearchParam.redirectTo]);

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <SignInForm
        requestMagicLink={requestMagicLink.bind(null, redirectTo)}
        failureMessage={failureMessage}
      />
    </main>
  );
}
