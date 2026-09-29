import type { CreateApplicationField } from "@/domain/application/schema";

/** The create fields this slice's form offers; the rest keep their schema defaults. */
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

export function isApplicationFormField(field: string): field is ApplicationFormField {
  return (applicationFormFields as readonly string[]).includes(field);
}
