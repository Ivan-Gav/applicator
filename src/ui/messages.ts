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
import { JsonReadFailure } from "@/domain/application/json";
import type { SortDirection } from "@/domain/application/list";
import type { DocumentFormat } from "@/domain/document/format";
import {
  type DocumentLanguage,
  type DocumentType,
  DocumentUploadFailure,
} from "@/domain/document/model";
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
    documents: "Documents",
    signOut: "Sign out",
    darkTheme: "Dark theme",
  },

  footer: {
    sourceCode: "Source code on GitHub",
    copyright: "© 2026 Ivan Gavrilin",
    // GeoNames requires attribution under CC BY 4.0.
    placeData: "Place names from",
    placeDataSource: "GeoNames",
    placeDataLicence: "CC BY 4.0",
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

  // Shared by the lists: applications and documents.
  list: {
    sortIndicator: {
      asc: "▲",
      desc: "▼",
    } satisfies Record<SortDirection, string>,
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
      company: "Company and position",
      city: "City",
      status: "Status",
      waiting: "Waiting",
      actions: "Actions",
    },
    notApplied: "Not recorded",
    // Days without a response; the short form is shown, the spoken one read out.
    waiting: {
      days: (days: number) => `${days} d`,
      daysSpoken: (days: number) => (days === 1 ? "1 day" : `${days} days`),
      none: "—",
      noneSpoken: "Not waiting",
    },
    views: {
      label: "Applications shown",
      active: "Active",
      archived: "Archived",
    },
    nothingMatches: {
      title: "Nothing matches",
      description: "Try another word, or clear the filters.",
    },
    showMore: "Show more",
    search: {
      label: "Search applications",
      placeholder: "Search company, position or city",
    },
    // How many the view holds, and how many the filters let through.
    count: (total: number) => (total === 1 ? "1 application" : `${total} applications`),
    countFiltered: (matching: number, total: number) => `${matching} of ${total} match`,
    filters: {
      label: "Filter",
      waitingLong: (days: number) => `Waiting ${days}+ days`,
      // The city menu's button: "City", "City: Munich", "City: 3".
      cities: (chosen: readonly string[]) =>
        chosen.length === 0 ? "City" : `City: ${chosen.length === 1 ? chosen[0] : chosen.length}`,
      clear: "Clear filters",
    },
    emptyArchived: {
      title: "No archived applications",
      description:
        "Archive an application to keep it out of the way. It stays here, with its history, until you restore it.",
    },
    actions: {
      // The accessible name of a row action: the visible label, then the application.
      label: (action: string, name: string) => `${action}: ${name}`,
      archive: "Archive",
      unarchive: "Restore",
      delete: "Delete",
      failed: "That did not work. Try again in a moment.",
    },
    statusChange: {
      // The status tag's accessible name: its visible label first.
      trigger: (status: string, name: string) => `${status}. Change status: ${name}`,
      menuTitle: "Move to",
      // A status entered again, such as a further interview round.
      again: (status: string) => `${status} (another round)`,
      failure: {
        [StatusChangeFailure.Invalid]: "The status could not be changed. Choose one from the list.",
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
      waiting: "Waiting",
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
      paste: {
        title: "Fill in from JSON",
        label: "Application as JSON",
        hint: "Paste one application as a JSON object. It only fills in the form: check the fields, then save as usual.",
        format: "Read about the format",
        apply: "Fill in the form",
        failure: {
          [JsonReadFailure.Malformed]:
            "This is not valid JSON. Check for missing quotes, commas or brackets.",
          [JsonReadFailure.List]: "Paste one application at a time, not a list.",
          [JsonReadFailure.NotAnObject]: 'Paste a JSON object, such as { "companyName": "Acme" }.',
        } satisfies Record<JsonReadFailure, string>,
        filled: "The form is filled in. Check it, then save.",
        rejected: (count: number) =>
          count === 1
            ? "1 value did not fit its field. The field is left empty and marked: change it, or choose “Leave empty”, before saving."
            : `${count} values did not fit their fields. The fields are left empty and marked: change each, or choose “Leave empty”, before saving.`,
        // Saving is refused while a mark stays.
        unresolved:
          "Some pasted values did not fit. Change each marked field, or choose “Leave empty”, before saving.",
        // Accepts a marked field as it is; the visible text first, then the field it concerns.
        leaveEmpty: "Leave empty",
        leaveEmptyLabel: (field: string) => `Leave empty: ${field}`,
        example: {
          label: "Example JSON:",
          copy: "Copy",
          copyLabel: "Copy example JSON",
          download: "Download",
          downloadLabel: "Download example JSON",
          fileName: "application-example.json",
          copied: "Example JSON copied.",
          copyFailed: "The example could not be copied. Download it instead.",
          // Also the first example of docs/application-json.md; a test keeps the two the same.
          value: {
            companyName: "Initech",
            positionTitle: "Senior Platform Engineer",
            seniority: "senior",
            status: "applied",
            appliedAt: "2026-09-01",
            city: "Munich",
            country: "Germany",
            workMode: "hybrid",
            channel: "direct",
            source: "LinkedIn",
            sourceUrl: "https://example.com/jobs/platform-engineer",
            applicationUrl: "https://example.com/jobs/platform-engineer/apply",
            notes: "Kubernetes and Go. Team of six, on call one week in eight.",
            salary: {
              advertised: { min: 75000, max: 90000 },
              asked: { min: 85000, max: 85000 },
              currency: "EUR",
              period: "year",
            },
            contact: {
              name: "Jane Doe",
              role: "Technical Recruiter",
              email: "jane.doe@example.com",
            },
          },
        },
        unknownKeys: (keys: readonly string[]) =>
          `Not part of an application, so left out: ${keys.join(", ")}.`,
        // Shown under a field beside its error: what arrived for it.
        rejectedValue: (value: string) => `Pasted: ${value}`,
        // A salary or contact given as something other than an object.
        blockRejected: "Expected an object with the fields the format lists.",
      },
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
      source: {
        hint: "Where you found the job. Pick one from the list or type any name.",
        matches: "Suggested sources",
        // How many sources are suggested, read out as they arrive.
        found: (count: number) => (count === 1 ? "1 source found" : `${count} sources found`),
      },
      city: {
        hint: "Type any place; picking a suggestion also fills in its country.",
        matches: "Suggested cities",
        // How many cities are suggested, read out as they arrive.
        found: (count: number) => (count === 1 ? "1 city found" : `${count} cities found`),
        // A city found by another of its names: "Munich (München)".
        option: (name: string, matchedName: string | null) =>
          matchedName ? `${name} (${matchedName})` : name,
        // What tells same-named cities apart: "Bavaria, Germany".
        place: (parts: readonly string[]) => parts.join(", "),
      },
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
        // A row of the salary grid: its label, then the from and to boxes.
        rows: {
          advertised: "Advertised",
          estimated: "Estimated",
          asked: "Asked",
        } satisfies Record<SalaryAmount, string>,
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
        // "Jane Doe · Recruiter", from whichever of the two is known.
        summary: (parts: readonly string[]) => parts.join(" · "),
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
      assignment: "Assignment",
      interview: "Interview",
      offer: "Offer",
      rejected: "Rejected",
      withdrawn: "Withdrawn",
    } satisfies Record<ApplicationStatus, string>,
  },

  documents: {
    title: "Documents",
    upload: "Upload document",
    empty: {
      title: "No documents yet",
      description: "Upload a CV, cover letter or certificate and it will show up here.",
    },
    type: {
      cv: "CV",
      cover_letter: "Cover letter",
      certificate: "Certificate",
      diploma: "Diploma",
      reference: "Reference",
      portfolio: "Portfolio",
      other: "Other",
    } satisfies Record<DocumentType, string>,
    language: {
      en: "English",
      de: "German",
      ru: "Russian",
    } satisfies Record<DocumentLanguage, string>,
    languageUnset: "Not specified",
    format: {
      pdf: "PDF",
      doc: "DOC",
      docx: "DOCX",
      odt: "ODT",
      rtf: "RTF",
      txt: "TXT",
      png: "PNG",
      jpeg: "JPEG",
      webp: "WebP",
    } satisfies Record<DocumentFormat, string>,
    // "PDF, 240.5 kB"
    fileSummary: (format: string, size: string) => `${format}, ${size}`,
    columns: {
      document: "Document",
      type: "Type",
      language: "Language",
      version: "Version",
      uploaded: "Uploaded",
      actions: "Actions",
    },
    // How many the list holds, and how many the search and filters let through.
    count: (total: number) => (total === 1 ? "1 document" : `${total} documents`),
    countFiltered: (matching: number, total: number) => `${matching} of ${total} shown`,
    search: {
      label: "Search documents",
      placeholder: "Search titles, file names and versions",
    },
    // The row's link, which opens the chosen version's file; the version only when there are versions.
    open: (title: string, version: string | null) =>
      version === null
        ? `Open ${title} (opens in a new tab)`
        : `Open ${title}, version ${version} (opens in a new tab)`,
    filters: {
      label: "Filter",
      types: "Type",
      languages: "Language",
      clear: "Clear filters",
    },
    nothingMatches: {
      title: "Nothing matches",
      description: "Try another word, or clear the filters.",
    },
    showMore: "Show more",
    versions: {
      // The version select's accessible name.
      select: (title: string) => `Version of ${title}`,
      // A version without a label: the first upload, then by its place counting from it.
      original: "Original",
      numbered: (number: number) => `Version ${number}`,
    },
    actions: {
      // The accessible name of an action: the visible label, then what it acts on.
      label: (action: string, name: string) => `${action}: ${name}`,
      download: "Download",
      addVersion: "Add version",
      rename: "Rename",
      delete: "Delete",
      failed: "That did not work. Try again in a moment.",
    },
    form: {
      file: "File",
      chooseFile: "Choose file",
      fileHint: (maxSize: string) =>
        `PDF, Word (DOC, DOCX), OpenDocument text, RTF, plain text, or an image (PNG, JPEG, WebP), up to ${maxSize}.`,
      type: "Type",
      title: "Title",
      language: "Language",
      label: "Version label",
      labelHint: "Optional. What sets this file apart, such as “backend-heavy” or “short”.",
      errors: {
        fileMissing: "Choose a file.",
        title: "Enter a title, up to 200 characters.",
      },
      cancel: "Cancel",
      submit: "Upload",
      submitting: "Uploading…",
      failure: {
        [DocumentUploadFailure.Invalid]:
          "The upload could not be read. Check the fields and try again.",
        [DocumentUploadFailure.Empty]: "This file is empty. Choose another one.",
        [DocumentUploadFailure.TooLarge]:
          "This file is larger than the limit given above. Choose a smaller one.",
        [DocumentUploadFailure.UnsupportedType]:
          "Files of this type are not accepted. Choose a PDF, a Word, OpenDocument, RTF or text file, or an image.",
        [DocumentUploadFailure.ContentMismatch]:
          "This file’s content does not match its extension. Save it again in its own format, then upload it.",
        [DocumentUploadFailure.Missing]: "This document no longer exists. Reload the page.",
      } satisfies Record<DocumentUploadFailure, string>,
      failed: "The file could not be uploaded. Try again in a moment.",
    },
    uploadDialog: {
      title: "Upload document",
      description: "A document is one CV, letter or certificate. Its first version is this file.",
    },
    versionDialog: {
      title: (name: string) => `New version of “${name}”`,
      description:
        "The new file becomes the current version. The earlier ones stay as they are and can still be downloaded.",
    },
    renameDialog: {
      title: "Rename document",
      submit: "Save",
      saving: "Saving…",
      cancel: "Cancel",
      rejected: "Enter a title, up to 200 characters.",
    },
    deleteDialog: {
      title: "Delete this document?",
      // `versions` is null for a document without versions to tell apart.
      description: (name: string, versions: number | null) =>
        versions === null
          ? `“${name}” will be deleted permanently. This cannot be undone.`
          : `“${name}” and its ${versions === 1 ? "version" : `${versions} versions`} will be deleted permanently. This cannot be undone.`,
      confirm: "Delete permanently",
      deleting: "Deleting…",
      cancel: "Cancel",
    },
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
