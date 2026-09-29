import type { ApplicationStatus, WorkMode } from "@/domain/application/model";
import { SignInFailureReason } from "@/domain/user/model";
import type { ApplicationFormField } from "./applications/application-form-fields";

/** Every user-facing string, grouped by screen. */
export const messages = {
  app: {
    name: "Applicator",
    description: "Job application tracker",
  },

  home: {
    summary:
      "Keep every job application in one place: where you applied, where it stands, and how long each one has gone without a response.",
    signIn: "Sign in",
    openApplications: "Open applications",
    sourceCode: "Source code on GitHub",
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
    add: "Add application",
    empty: {
      title: "No applications yet",
      description:
        "Add the first job you have applied for or are preparing to apply for, and it will show up here.",
    },
    columns: {
      company: "Company",
      position: "Position",
      status: "Status",
      appliedAt: "Applied",
    },
    notApplied: "Not recorded",
    workMode: {
      on_site: "On site",
      hybrid: "Hybrid",
      remote: "Remote",
    } satisfies Record<WorkMode, string>,
    form: {
      title: "New application",
      labels: {
        companyName: "Company",
        positionTitle: "Position",
        status: "Status",
        appliedAt: "Applied on",
        city: "City",
        workMode: "Work mode",
        source: "Source",
        applicationUrl: "Application URL",
        notes: "Notes",
      } satisfies Record<ApplicationFormField, string>,
      workModeUnset: "Not specified",
      sourceHint: "Where you found the job, such as LinkedIn or a company website.",
      errors: {
        companyName: "Enter the company name, up to 200 characters.",
        positionTitle: "Enter the position title, up to 200 characters.",
        status: "Choose a status from the list.",
        appliedAt: "Enter a valid date.",
        city: "Enter a city or leave the field empty.",
        workMode: "Choose a work mode from the list.",
        source: "Enter a source or leave the field empty.",
        applicationUrl: "Enter a full web address starting with http:// or https://.",
        notes: "Enter notes or leave the field empty.",
      } satisfies Record<ApplicationFormField, string>,
      rejected: "The application could not be saved. Check the details and try again.",
      saveFailed: "The application could not be saved. Try again in a moment.",
      submit: "Save application",
      saving: "Saving…",
      cancel: "Cancel",
    },
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
