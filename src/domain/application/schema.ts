import { z } from "zod";
import {
  applicationStatuses,
  channels,
  defaultSalaryPeriod,
  salaryPeriods,
  seniorities,
  workModes,
} from "./model";

// Form fields arrive as "" when left blank; the domain stores absence as null.
const blankToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const optionalText = z.preprocess(blankToNull, z.string().trim().min(1).nullable());
const optionalUrl = z.preprocess(blankToNull, z.url({ protocol: /^https?$/ }).nullable());
const optionalEmail = z.preprocess(blankToNull, z.email().nullable());

// An instant. A day picked in a form becomes one in the browser, which alone
// knows the user's time zone.
const optionalInstant = z.date().nullable();

const amount = z.int32().nonnegative().nullable().default(null);

export const salaryRangeSchema = z
  .object({ min: amount, max: amount })
  .refine((range) => range.min === null || range.max === null || range.min <= range.max, {
    path: ["min"],
  });

export const salarySchema = z.object({
  advertised: salaryRangeSchema.default({ min: null, max: null }),
  estimated: salaryRangeSchema.default({ min: null, max: null }),
  asked: salaryRangeSchema.default({ min: null, max: null }),
  currency: z.preprocess(
    blankToNull,
    z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/)
      .toUpperCase()
      .nullable()
      .default("EUR"),
  ),
  period: z.enum(salaryPeriods).default(defaultSalaryPeriod),
});

export const contactSchema = z.object({
  name: optionalText.default(null),
  role: optionalText.default(null),
  email: optionalEmail.default(null),
  phone: optionalText.default(null),
  url: optionalUrl.default(null),
});

export const applicationStatusSchema = z.enum(applicationStatuses);

// Once created, status, appliedAt and lastContactAt change only through the
// transition rules.
const editableFields = {
  companyName: z.string().trim().min(1).max(200),
  positionTitle: z.string().trim().min(1).max(200),
  seniority: z.enum(seniorities).nullable(),
  city: optionalText,
  country: optionalText,
  workMode: z.enum(workModes).nullable(),
  channel: z.enum(channels),
  source: optionalText,
  sourceUrl: optionalUrl,
  applicationUrl: optionalUrl,
  salary: salarySchema,
  contact: contactSchema,
  notes: optionalText,
};

export const createApplicationSchema = z.object({
  companyName: editableFields.companyName,
  positionTitle: editableFields.positionTitle,
  // Any status may start a record; isStatusTransitionAllowed() governs only later changes.
  status: applicationStatusSchema.default("draft"),
  appliedAt: optionalInstant.default(null),
  seniority: editableFields.seniority.default(null),
  city: editableFields.city.default(null),
  country: editableFields.country.default(null),
  workMode: editableFields.workMode.default(null),
  channel: editableFields.channel.default("direct"),
  source: editableFields.source.default(null),
  sourceUrl: editableFields.sourceUrl.default(null),
  applicationUrl: editableFields.applicationUrl.default(null),
  salary: editableFields.salary.default({
    advertised: { min: null, max: null },
    estimated: { min: null, max: null },
    asked: { min: null, max: null },
    currency: "EUR",
    period: defaultSalaryPeriod,
  }),
  contact: editableFields.contact.default({
    name: null,
    role: null,
    email: null,
    phone: null,
    url: null,
  }),
  notes: editableFields.notes.default(null),
});

// Must not derive from createApplicationSchema: its defaults would fill absent
// keys and reset every field the patch leaves out.
export const updateApplicationSchema = z
  .object(editableFields)
  .partial()
  .refine((patch) => Object.values(patch).some((value) => value !== undefined));

export const applicationIdSchema = z.uuid();

// A move to `status`. It is dated when it is stored, never by the caller.
export const statusChangeSchema = z.object({
  status: applicationStatusSchema,
});

export type CreateApplicationInput = z.input<typeof createApplicationSchema>;
export type CreateApplication = z.output<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.input<typeof updateApplicationSchema>;
export type UpdateApplication = z.output<typeof updateApplicationSchema>;
export type StatusChange = z.output<typeof statusChangeSchema>;

type SalaryPart = keyof z.output<typeof salarySchema>;

/**
 * A field the create or update input can be rejected on: a top-level field, or
 * one part of the salary block, so that a failure names the amount it concerns.
 */
export type ApplicationField = keyof CreateApplicationInput | `salary.${SalaryPart}`;

/** Returned by the create and update actions when the input is rejected. */
export type ApplicationRejection = { invalidFields: ApplicationField[] };

const topLevelFields = new Set<PropertyKey>(Object.keys(createApplicationSchema.shape));
const salaryParts = new Set<PropertyKey>(Object.keys(salarySchema.shape));

function fieldOf([top, part]: readonly PropertyKey[]): ApplicationField | null {
  if (top === "salary" && salaryParts.has(part as PropertyKey)) {
    return `salary.${part as SalaryPart}`;
  }
  return topLevelFields.has(top as PropertyKey) ? (top as keyof CreateApplicationInput) : null;
}

/** The fields a failed parse of the create or update input complained about, each once. */
export function invalidApplicationFields(error: z.ZodError): ApplicationField[] {
  const fields = error.issues.map((issue) => fieldOf(issue.path));
  return [...new Set(fields)].filter((field) => field !== null);
}
