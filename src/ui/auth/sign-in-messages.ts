import {
  MagicLinkRequestStatus,
  type MagicLinkRequestOutcome,
  SignInFailureReason,
} from "@/domain/user/model";
import { messages } from "@/ui/messages";

const t = messages.signIn;

export function signInFailureMessage(reason: SignInFailureReason): string {
  return t.failure[reason];
}

export function magicLinkOutcomeMessage(
  outcome: Exclude<MagicLinkRequestOutcome, { status: typeof MagicLinkRequestStatus.Sent }>,
): string {
  switch (outcome.status) {
    case MagicLinkRequestStatus.InvalidEmail:
      return t.invalidEmail;
    case MagicLinkRequestStatus.RateLimited:
      return t.rateLimited(outcome.retryAfterSeconds);
    case MagicLinkRequestStatus.Unavailable:
      return t.failure[SignInFailureReason.Unavailable];
  }
}
