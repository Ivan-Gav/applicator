import type { ApplicationField } from "@/domain/application/schema";

/** The top-level fields the form offers; the rest keep their schema defaults. */
export const applicationFormFields = [
  "companyName",
  "positionTitle",
  "seniority",
  "status",
  "appliedAt",
  "city",
  "country",
  "workMode",
  "channel",
  "source",
  "sourceUrl",
  "applicationUrl",
  "notes",
] as const satisfies readonly ApplicationField[];

export type ApplicationFormField = (typeof applicationFormFields)[number];

/** Fields only a new application takes; afterwards they change through transitions. */
export const createOnlyFormFields = [
  "status",
  "appliedAt",
] as const satisfies readonly ApplicationFormField[];

/** The salary parts the form offers; a rejection of one is shown beside it. */
export const salaryFormFields = [
  "salary.advertised",
  "salary.estimated",
  "salary.asked",
  "salary.currency",
  "salary.period",
] as const satisfies readonly ApplicationField[];

export type SalaryFormField = (typeof salaryFormFields)[number];

export function isApplicationFormField(field: string): field is ApplicationFormField {
  return (applicationFormFields as readonly string[]).includes(field);
}

export function isSalaryFormField(field: string): field is SalaryFormField {
  return (salaryFormFields as readonly string[]).includes(field);
}
