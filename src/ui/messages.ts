import {
  type ApplicationStatus,
  type Channel,
  type ContactPart,
  type SalaryAmount,
  type SalaryPeriod,
  type SalaryRangeKind,
  type Seniority,
  StatusChangeFailure,
  type WorkMode,
} from "@/domain/application/model";
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
    label: "Main",
    applications: "Applications",
    signOut: "Sign out",
    darkTheme: "Dark theme",
  },

  footer: {
    sourceCode: "Source code on GitHub",
    copyright: "© 2026 Ivan Gavrilin",
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
    back: "Back to applications",
    empty: {
      title: "No applications yet",
      description:
        "Add the first job you have applied for or are preparing to apply for, and it will show up here.",
    },
    // "Engineer at Acme": names one application wherever it must be told apart.
    name: ({ companyName, positionTitle }: { companyName: string; positionTitle: string }) =>
      `${positionTitle} at ${companyName}`,
    columns: {
      appliedAt: "Applied",
      company: "Company",
      position: "Position",
      city: "City",
      status: "Status",
      actions: "Actions",
    },
    notApplied: "Not recorded",
    views: {
      label: "Applications shown",
      active: "Active",
      archived: "Archived",
    },
    emptyArchived: {
      title: "No archived applications",
      description:
        "Archive an application to keep it out of the way. It stays here, with its history, until you restore it.",
    },
    actions: {
      // The accessible name of a row action: the visible label, then the application.
      label: (action: string, name: string) => `${action}: ${name}`,
      edit: "Edit",
      changeStatus: "Change status",
      archive: "Archive",
      unarchive: "Restore",
      delete: "Delete",
      failed: "That did not work. Try again in a moment.",
    },
    statusChange: {
      title: "Change status",
      description: (name: string, status: string) => `“${name}” is now at ${status}.`,
      status: "New status",
      submit: "Change status",
      saving: "Saving…",
      cancel: "Cancel",
      failure: {
        [StatusChangeFailure.Invalid]: "The status could not be changed. Choose one from the list.",
        [StatusChangeFailure.Illegal]:
          "This application cannot move to that status from where it stands now.",
        [StatusChangeFailure.Outdated]:
          "This application changed in the meantime. Reload the page and try again.",
      } satisfies Record<StatusChangeFailure, string>,
      failed: "The status could not be changed. Try again in a moment.",
    },
    deleteDialog: {
      title: "Delete this application?",
      description: (name: string) =>
        `“${name}” and its status history will be deleted permanently. This cannot be undone. To keep it out of the way instead, archive it.`,
      confirm: "Delete permanently",
      deleting: "Deleting…",
      cancel: "Cancel",
    },
    page: {
      appliedAt: "Applied",
      lastContactAt: "Last contact",
      noContact: "None yet",
      archivedAt: "Archived",
      details: "Details",
      history: "Status history",
    },
    salary: {
      range: {
        unknown: () => "Not stated",
        exact: ({ amount }: { amount: string }) => amount,
        between: ({ min, max }: { min: string; max: string }) => `${min}–${max}`,
        from: ({ min }: { min: string }) => `from ${min}`,
        up_to: ({ max }: { max: string }) => `up to ${max}`,
      } satisfies Record<SalaryRangeKind, unknown>,
      period: {
        year: "per year",
        month: "per month",
        day: "per day",
        hour: "per hour",
      } satisfies Record<SalaryPeriod, string>,
      // "60,000–70,000 EUR per year"; the currency may be missing.
      amount: (range: string, currency: string | null, period: string) =>
        [range, currency, period].filter(Boolean).join(" "),
    },
    workMode: {
      on_site: "On site",
      hybrid: "Hybrid",
      remote: "Remote",
    } satisfies Record<WorkMode, string>,
    seniority: {
      junior: "Junior",
      mid: "Mid-level",
      senior: "Senior",
      lead: "Lead",
    } satisfies Record<Seniority, string>,
    channel: {
      direct: "Directly to the employer",
      agency: "Through an agency",
      referral: "By referral",
    } satisfies Record<Channel, string>,
    form: {
      title: "New application",
      labels: {
        companyName: "Company",
        positionTitle: "Position",
        seniority: "Seniority",
        status: "Status",
        appliedAt: "Applied on",
        city: "City",
        country: "Country",
        workMode: "Work mode",
        channel: "How you applied",
        source: "Source",
        sourceUrl: "Job posting URL",
        applicationUrl: "Application URL",
        notes: "Notes",
      } satisfies Record<ApplicationFormField, string>,
      workModeUnset: "Not specified",
      seniorityUnset: "Not specified",
      sourceHint: "Where you found the job, such as LinkedIn or a company website.",
      errors: {
        companyName: "Enter the company name, up to 200 characters.",
        positionTitle: "Enter the position title, up to 200 characters.",
        status: "Choose a status from the list.",
        appliedAt: "Enter a valid date.",
        seniority: "Choose a seniority from the list.",
        city: "Enter a city or leave the field empty.",
        country: "Enter a country or leave the field empty.",
        workMode: "Choose a work mode from the list.",
        channel: "Choose how you applied from the list.",
        source: "Enter a source or leave the field empty.",
        sourceUrl: "Enter a full web address starting with http:// or https://.",
        applicationUrl: "Enter a full web address starting with http:// or https://.",
        notes: "Enter notes or leave the field empty.",
      } satisfies Record<ApplicationFormField, string>,
      salary: {
        title: "Salary",
        hint: "Optional. Whole numbers without separators. For a single figure, enter it in both boxes; for “from” or “up to”, fill in one box only.",
        amounts: {
          advertised: { from: "Advertised: from", to: "Advertised: to" },
          estimated: { from: "Estimated: from", to: "Estimated: to" },
          asked: { from: "Asked: from", to: "Asked: to" },
        } satisfies Record<SalaryAmount, { from: string; to: string }>,
        currency: "Currency",
        period: "Period",
        errors: {
          amount: "Enter whole numbers without separators, the first no higher than the second.",
          currency: "Enter a three-letter currency code, such as EUR.",
          period: "Choose a period from the list.",
        },
      },
      contact: {
        title: "Contact",
        labels: {
          name: "Contact name",
          role: "Contact role",
          email: "Contact email",
          phone: "Contact phone",
          url: "Contact profile URL",
        } satisfies Record<ContactPart, string>,
        errors: {
          name: "Enter a name or leave the field empty.",
          role: "Enter a role or leave the field empty.",
          email: "Enter a valid email address or leave the field empty.",
          phone: "Enter a phone number or leave the field empty.",
          url: "Enter a full web address starting with http:// or https://.",
        } satisfies Record<ContactPart, string>,
      },
      rejected: "The application could not be saved. Check the details and try again.",
      saveFailed: "The application could not be saved. Try again in a moment.",
      submit: "Save application",
      saveChanges: "Save changes",
      saving: "Saving…",
      saved: "Changes saved.",
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
