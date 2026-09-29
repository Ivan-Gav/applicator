import { z } from "zod";
import { applicationStatuses, channels, salaryPeriods, seniorities, workModes } from "./model";

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
  posted: salaryRangeSchema.default({ min: null, max: null }),
  asked: salaryRangeSchema.default({ min: null, max: null }),
  target: salaryRangeSchema.default({ min: null, max: null }),
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
  period: z.enum(salaryPeriods).nullable().default(null),
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
  // Any status may start a record; canTransition() governs only later changes.
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
    posted: { min: null, max: null },
    asked: { min: null, max: null },
    target: { min: null, max: null },
    currency: "EUR",
    period: null,
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

export type CreateApplicationInput = z.input<typeof createApplicationSchema>;
export type CreateApplication = z.output<typeof createApplicationSchema>;
export type CreateApplicationField = keyof CreateApplicationInput;
export type UpdateApplicationInput = z.input<typeof updateApplicationSchema>;
export type UpdateApplication = z.output<typeof updateApplicationSchema>;

/** Returned by the create action in place of a redirect when the input is rejected. */
export type CreateApplicationRejection = { invalidFields: CreateApplicationField[] };

/** The top-level fields a failed parse of the create input complained about, each once. */
export function invalidCreateFields(error: z.ZodError): CreateApplicationField[] {
  const fields = error.issues.map((issue) => issue.path[0]);
  const known = new Set<PropertyKey>(Object.keys(createApplicationSchema.shape));
  return [...new Set(fields)].filter(
    (field): field is CreateApplicationField => field !== undefined && known.has(field),
  );
}
