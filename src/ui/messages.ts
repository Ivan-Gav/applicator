import type { ApplicationStatus } from "@/domain/application/model";
import { SignInFailureReason } from "@/domain/user/model";

/**
 * Every user-facing string, grouped by screen. Components read text only from
 * here, so the next-intl step can turn this object into messages/en.json and a
 * German twin without hunting through the tree.
 *
 * Parameterised messages are functions for now; next-intl will express them as
 * ICU placeholders instead.
 */
export const messages = {
  app: {
    name: "Applicator",
    description: "Job application tracker",
  },

  home: {
    getStarted: "Get started",
  },

  nav: {
    signOut: "Sign out",
  },

  error: {
    title: "Something went wrong",
    description:
      "The page could not be loaded. Try again, and if it keeps happening, come back later.",
    authUnavailableTitle: "Temporarily unavailable",
    authUnavailableDescription:
      "Your sign-in could not be checked because the service is temporarily unavailable. You are still signed in; try again in a moment.",
    retry: "Try again",
  },

  applications: {
    title: "Applications",
    status: {
      draft: "Draft",
      applied: "Applied",
      screening: "Screening",
      interview: "Interview",
      offer: "Offer",
      rejected: "Rejected",
      withdrawn: "Withdrawn",
    } satisfies Record<ApplicationStatus, string>,
  },

  signIn: {
    title: "Sign in",
    description:
      "Enter your email address and we will send you a one-time sign-in link. No password needed; a new address creates your account.",
    emailLabel: "Email address",
    submit: "Send sign-in link",
    sending: "Sending…",
    invalidEmail: "Enter a valid email address.",
    rateLimited: (retryAfterSeconds: number | null) =>
      retryAfterSeconds === null
        ? "Too many sign-in links were requested for this address. Wait a minute, then try again."
        : `Too many sign-in links were requested for this address. Wait ${retryAfterSeconds} seconds, then try again.`,

    failureTitle: "Sign-in did not complete",
    failure: {
      [SignInFailureReason.LinkExpired]:
        "This sign-in link has expired or was already used. Links work once and expire after an hour, and some mail systems open them on delivery. Request a new one below.",
      [SignInFailureReason.LinkInvalid]: "This sign-in link is not valid. Request a new one below.",
      [SignInFailureReason.VerifierMissing]:
        "Open the link in the same browser where you requested it. A sign-in link only works in the browser that asked for it, so another device or a private window will not do. Request a new link from this browser below.",
      [SignInFailureReason.SessionExpired]: "Your session has ended. Sign in again to continue.",
      [SignInFailureReason.Unavailable]:
        "Sign-in is temporarily unavailable. Please try again in a moment.",
    } satisfies Record<SignInFailureReason, string>,

    inbox: {
      title: "Check your inbox",
      // Split around the address, which is rendered in bold between the two.
      sentToBefore: "We sent a sign-in link to",
      sentToAfter: ".",
      hint: "Open it in this browser to finish signing in. The link works once and expires after an hour.",
      resent: "A new link is on its way.",
      sendAgain: "Send again",
      useDifferentAddress: "Use a different address",
    },
  },
} as const;
