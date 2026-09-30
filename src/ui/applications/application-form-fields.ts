import type { CreateApplicationField } from "@/domain/application/schema";

/** The top-level create fields this form offers; the rest keep their schema defaults. */
export const applicationFormFields = [
  "companyName",
  "positionTitle",
  "status",
  "appliedAt",
  "city",
  "workMode",
  "source",
  "applicationUrl",
  "notes",
] as const satisfies readonly CreateApplicationField[];

export type ApplicationFormField = (typeof applicationFormFields)[number];

/** The salary parts the form offers; a rejection of one is shown beside it. */
export const salaryFormFields = [
  "salary.advertised",
  "salary.estimated",
  "salary.asked",
  "salary.currency",
  "salary.period",
] as const satisfies readonly CreateApplicationField[];

export type SalaryFormField = (typeof salaryFormFields)[number];

export function isApplicationFormField(field: string): field is ApplicationFormField {
  return (applicationFormFields as readonly string[]).includes(field);
}

export function isSalaryFormField(field: string): field is SalaryFormField {
  return (salaryFormFields as readonly string[]).includes(field);
}
