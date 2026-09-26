import { describe, expect, it } from "vitest";
import {
  MagicLinkRequestStatus,
  SignInFailureReason,
  signInFailureReasons,
} from "@/domain/user/model";
import { magicLinkOutcomeMessage, signInFailureMessage } from "./sign-in-messages";

describe("signInFailureMessage", () => {
  it.each(signInFailureReasons)("has a non-empty message for %s", (reason) => {
    expect(signInFailureMessage(reason).length).toBeGreaterThan(20);
  });

  it("tells the user to open the link in the same browser when the verifier is missing", () => {
    expect(signInFailureMessage(SignInFailureReason.VerifierMissing)).toMatch(/same browser/i);
  });

  it("explains that expired links may have been opened by a mail system", () => {
    expect(signInFailureMessage(SignInFailureReason.LinkExpired)).toMatch(/expired/i);
    expect(signInFailureMessage(SignInFailureReason.LinkExpired)).toMatch(/mail/i);
  });

  it("asks for a new link in every callback failure", () => {
    for (const reason of [
      SignInFailureReason.LinkExpired,
      SignInFailureReason.LinkInvalid,
      SignInFailureReason.VerifierMissing,
    ]) {
      expect(signInFailureMessage(reason)).toMatch(/request a new/i);
    }
  });
});

describe("magicLinkOutcomeMessage", () => {
  it("names the wait when Supabase reports it", () => {
    expect(
      magicLinkOutcomeMessage({
        status: MagicLinkRequestStatus.RateLimited,
        retryAfterSeconds: 42,
      }),
    ).toMatch(/42 seconds/);
  });

  it("still gives a wait when Supabase does not say how long", () => {
    expect(
      magicLinkOutcomeMessage({
        status: MagicLinkRequestStatus.RateLimited,
        retryAfterSeconds: null,
      }),
    ).toMatch(/wait a minute/i);
  });

  it("asks for a valid address", () => {
    expect(magicLinkOutcomeMessage({ status: MagicLinkRequestStatus.InvalidEmail })).toMatch(
      /valid email/i,
    );
  });

  it("describes an outage as temporary", () => {
    expect(magicLinkOutcomeMessage({ status: MagicLinkRequestStatus.Unavailable })).toMatch(
      /temporarily/i,
    );
  });
});
