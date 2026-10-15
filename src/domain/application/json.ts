import type { z } from "zod";
import { readDay } from "@/lib/date";
import { normalizeForSearch } from "@/lib/normalize-for-search";
import {
  type ApplicationStatus,
  type Channel,
  type ContactPart,
  contactParts,
  type Salary,
  type SalaryAmount,
  type SalaryPeriod,
  type SalaryRange,
  type Seniority,
  salaryAmounts,
  type WorkMode,
} from "./model";
import {
  type CreateApplicationInput,
  contactSchema,
  createApplicationSchema,
  salaryRangeSchema,
  salarySchema,
} from "./schema";

/**
 * What a JSON object described and the schema accepts, field by field. Every
 * field is optional; what the object left out or set to null or "" is absent.
 */
export type ApplicationFromJson = {
  companyName?: string;
  positionTitle?: string;
  seniority?: Seniority;
  status?: ApplicationStatus;
  /** The day applied, as YYYY-MM-DD: the instant it starts at depends on the reader's time zone. */
  appliedAt?: string;
  city?: string;
  country?: string;
  workMode?: WorkMode;
  channel?: Channel;
  source?: string;
  sourceUrl?: string;
  applicationUrl?: string;
  notes?: string;
  salary?: Partial<Pick<Salary, SalaryAmount | "period">> & { currency?: string };
  contact?: Partial<Record<ContactPart, string>>;
};

type RangeEnd = keyof SalaryRange;

/** Where in the JSON object a value was rejected: a field, a salary part or a contact part. */
export type JsonApplicationField =
  | Exclude<keyof CreateApplicationInput, "salary" | "contact">
  | "salary"
  | `salary.${SalaryAmount}`
  | `salary.${SalaryAmount}.${RangeEnd}`
  | "salary.currency"
  | "salary.period"
  | "contact"
  | `contact.${ContactPart}`;

/** A value the object held that does not fit its field, kept as it arrived. */
export type RejectedValue = { field: JsonApplicationField; value: unknown };

export type ApplicationJsonReading = {
  values: ApplicationFromJson;
  rejected: RejectedValue[];
  /** Keys the format does not know, as dotted paths, e.g. "salary.bonus". */
  unknownKeys: string[];
};

// Why a text could not be read as an application at all.
export const JsonReadFailure = {
  // Not JSON.
  Malformed: "malformed",
  // JSON, but a list: one application at a time.
  List: "list",
  // JSON, but a single value rather than an object.
  NotAnObject: "not_an_object",
} as const;
export type JsonReadFailure = (typeof JsonReadFailure)[keyof typeof JsonReadFailure];

export type JsonReadOutcome =
  | { ok: true; reading: ApplicationJsonReading }
  | { ok: false; failure: JsonReadFailure };

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reads one application from JSON text; see {@link readApplicationObject}. */
export function readApplicationJson(text: string): JsonReadOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, failure: JsonReadFailure.Malformed };
  }
  if (Array.isArray(parsed)) {
    return { ok: false, failure: JsonReadFailure.List };
  }
  if (!isJsonObject(parsed)) {
    return { ok: false, failure: JsonReadFailure.NotAnObject };
  }
  return { ok: true, reading: readApplicationObject(parsed) };
}

// What a writer may say for a value with a fixed set, compared by matchKey().
// The value's own name always matches and need not be listed.
const statusVariants: Record<ApplicationStatus, readonly string[]> = {
  draft: [],
  applied: ["submitted", "sent"],
  screening: ["screen", "phone screen", "phone screening"],
  assignment: ["take home", "take home task", "test task", "home assignment"],
  interview: ["interviews", "interviewing"],
  offer: ["offered"],
  rejected: ["rejection"],
  withdrawn: ["withdrew"],
};

const seniorityVariants: Record<Seniority, readonly string[]> = {
  junior: ["jr"],
  mid: ["mid level", "middle", "intermediate"],
  senior: ["sr"],
  lead: ["team lead", "tech lead"],
};

const workModeVariants: Record<WorkMode, readonly string[]> = {
  on_site: ["office", "in office"],
  hybrid: [],
  remote: ["fully remote", "remote only"],
};

const channelVariants: Record<Channel, readonly string[]> = {
  direct: ["directly"],
  agency: ["recruitment agency", "recruiting agency", "headhunter"],
  referral: ["referred"],
};

const periodVariants: Record<SalaryPeriod, readonly string[]> = {
  year: ["yearly", "annual", "annually", "per year", "per annum", "p a", "yr"],
  month: ["monthly", "per month", "mo"],
  day: ["daily", "per day"],
  hour: ["hourly", "per hour", "hr"],
};

// Symbols and names naming one currency only; "$" names several.
const currencyNames: Readonly<Record<string, string>> = {
  "€": "EUR",
  euro: "EUR",
  euros: "EUR",
  "£": "GBP",
  us$: "USD",
};

// Case, accents, spaces and punctuation ignored: "On-site" and "on_site" both become "onsite".
function matchKey(text: string): string {
  return normalizeForSearch(text).replaceAll(" ", "");
}

function matchVariant<T extends string>(
  variants: Record<T, readonly string[]>,
  value: string,
): T | undefined {
  const key = matchKey(value);
  if (key === "") {
    return undefined;
  }
  const names = Object.keys(variants) as T[];
  return names.find(
    (name) => matchKey(name) === key || variants[name].some((variant) => matchKey(variant) === key),
  );
}

const isBlank = (value: unknown) =>
  value === undefined || value === null || (typeof value === "string" && value.trim() === "");

// What the schema makes of a non-blank string, or undefined when it refuses it.
function acceptText(schema: z.ZodType<unknown>, value: string): string | undefined {
  const parsed = schema.safeParse(value);
  return parsed.success && typeof parsed.data === "string" ? parsed.data : undefined;
}

const maxAmount = 2 ** 31 - 1;
const groupedDigits = /^\d{1,3}(?:[ ,.'’  ]\d{3})+$/;
const thousands = /^(\d+)\s?k$/i;

// A whole non-negative number, from a number or from text such as "60000",
// "60,000", "60 000" or "60k"; undefined for anything else.
function readAmount(value: unknown): number | undefined {
  let amount: number | undefined;
  if (typeof value === "number") {
    amount = value;
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    const inThousands = thousands.exec(trimmed);
    if (/^\d+$/.test(trimmed) || groupedDigits.test(trimmed)) {
      amount = Number(trimmed.replace(/\D/g, ""));
    } else if (inThousands) {
      amount = Number(inThousands[1]) * 1000;
    }
  }
  return amount !== undefined && Number.isInteger(amount) && amount >= 0 && amount <= maxAmount
    ? amount
    : undefined;
}

function readCurrency(value: string): string | undefined {
  const trimmed = value.trim();
  const named = currencyNames[trimmed.toLocaleLowerCase("en")];
  return acceptText(salarySchema.shape.currency, named ?? trimmed);
}

// What reading one object has found so far besides the accepted values.
type Findings = { rejected: RejectedValue[]; unknownKeys: string[] };

function reject(findings: Findings, field: JsonApplicationField, value: unknown) {
  findings.rejected.push({ field, value });
}

function noteUnknownKeys(
  findings: Findings,
  object: JsonObject,
  known: readonly string[],
  prefix = "",
) {
  for (const key of Object.keys(object)) {
    if (!known.includes(key)) {
      findings.unknownKeys.push(`${prefix}${key}`);
    }
  }
}

const textFields = [
  "companyName",
  "positionTitle",
  "city",
  "country",
  "source",
  "sourceUrl",
  "applicationUrl",
  "notes",
] as const;

function readFixedSet<T extends string>(
  findings: Findings,
  field: JsonApplicationField,
  variants: Record<T, readonly string[]>,
  value: unknown,
): T | undefined {
  if (isBlank(value)) {
    return undefined;
  }
  const matched = typeof value === "string" ? matchVariant(variants, value) : undefined;
  if (matched === undefined) {
    reject(findings, field, value);
  }
  return matched;
}

function readRange(
  findings: Findings,
  amount: SalaryAmount,
  value: unknown,
): SalaryRange | undefined {
  if (isBlank(value)) {
    return undefined;
  }
  if (!isJsonObject(value)) {
    reject(findings, `salary.${amount}`, value);
    return undefined;
  }
  noteUnknownKeys(findings, value, ["min", "max"], `salary.${amount}.`);
  const range: SalaryRange = { min: null, max: null };
  for (const end of ["min", "max"] as const) {
    if (isBlank(value[end])) {
      continue;
    }
    const read = readAmount(value[end]);
    if (read === undefined) {
      reject(findings, `salary.${amount}.${end}`, value[end]);
    } else {
      range[end] = read;
    }
  }
  if (range.min === null && range.max === null) {
    return undefined;
  }
  if (!salaryRangeSchema.safeParse(range).success) {
    reject(findings, `salary.${amount}`, value);
    return undefined;
  }
  return range;
}

function readSalary(findings: Findings, value: unknown): ApplicationFromJson["salary"] {
  if (isBlank(value)) {
    return undefined;
  }
  if (!isJsonObject(value)) {
    reject(findings, "salary", value);
    return undefined;
  }
  noteUnknownKeys(findings, value, [...salaryAmounts, "currency", "period"], "salary.");
  const salary: NonNullable<ApplicationFromJson["salary"]> = {};
  for (const amount of salaryAmounts) {
    const range = readRange(findings, amount, value[amount]);
    if (range) {
      salary[amount] = range;
    }
  }
  if (!isBlank(value.currency)) {
    const currency = typeof value.currency === "string" ? readCurrency(value.currency) : undefined;
    if (currency === undefined) {
      reject(findings, "salary.currency", value.currency);
    } else {
      salary.currency = currency;
    }
  }
  const period = readFixedSet(findings, "salary.period", periodVariants, value.period);
  if (period) {
    salary.period = period;
  }
  return Object.keys(salary).length > 0 ? salary : undefined;
}

function readContact(findings: Findings, value: unknown): ApplicationFromJson["contact"] {
  if (isBlank(value)) {
    return undefined;
  }
  if (!isJsonObject(value)) {
    reject(findings, "contact", value);
    return undefined;
  }
  noteUnknownKeys(findings, value, contactParts, "contact.");
  const contact: NonNullable<ApplicationFromJson["contact"]> = {};
  for (const part of contactParts) {
    const given = value[part];
    if (isBlank(given)) {
      continue;
    }
    const accepted =
      typeof given === "string" ? acceptText(contactSchema.shape[part], given) : undefined;
    if (accepted === undefined) {
      reject(findings, `contact.${part}`, given);
    } else {
      contact[part] = accepted;
    }
  }
  return Object.keys(contact).length > 0 ? contact : undefined;
}

const knownKeys = [...Object.keys(createApplicationSchema.shape)];

/**
 * Reads one application from a parsed JSON object, field by field: a value
 * that fits fills its field, one that does not is rejected on its own and
 * never keeps the others from being read. Fixed sets match ignoring case,
 * spaces and punctuation, and take common variants ("Full time" fits no work
 * mode and is rejected). Dates are read by readDay().
 */
export function readApplicationObject(object: JsonObject): ApplicationJsonReading {
  const values: ApplicationFromJson = {};
  const findings: Findings = { rejected: [], unknownKeys: [] };
  noteUnknownKeys(findings, object, knownKeys);

  for (const field of textFields) {
    const given = object[field];
    if (isBlank(given)) {
      continue;
    }
    const accepted =
      typeof given === "string"
        ? acceptText(createApplicationSchema.shape[field], given)
        : undefined;
    if (accepted === undefined) {
      reject(findings, field, given);
    } else {
      values[field] = accepted;
    }
  }

  const seniority = readFixedSet(findings, "seniority", seniorityVariants, object.seniority);
  const status = readFixedSet(findings, "status", statusVariants, object.status);
  const workMode = readFixedSet(findings, "workMode", workModeVariants, object.workMode);
  const channel = readFixedSet(findings, "channel", channelVariants, object.channel);
  if (seniority) {
    values.seniority = seniority;
  }
  if (status) {
    values.status = status;
  }
  if (workMode) {
    values.workMode = workMode;
  }
  if (channel) {
    values.channel = channel;
  }

  if (!isBlank(object.appliedAt)) {
    const day = typeof object.appliedAt === "string" ? readDay(object.appliedAt) : null;
    if (day === null) {
      reject(findings, "appliedAt", object.appliedAt);
    } else {
      values.appliedAt = day;
    }
  }

  const salary = readSalary(findings, object.salary);
  if (salary) {
    values.salary = salary;
  }
  const contact = readContact(findings, object.contact);
  if (contact) {
    values.contact = contact;
  }

  return { values, ...findings };
}
