import type { FieldPath } from "react-hook-form";
import type { JsonApplicationField, RejectedValue } from "@/domain/application/json";
import { contactParts, salaryAmounts } from "@/domain/application/model";
import type { CreateApplicationInput } from "@/domain/application/schema";
import { messages } from "@/ui/messages";
import { applicationFormFields } from "./application-form-fields";

const t = messages.applications.form.paste;

/** The line shown under a field for a value pasted into it and rejected: text in quotes, anything else as JSON. */
export function pastedValueError({ value }: RejectedValue): { message: string } {
  const shown = typeof value === "string" ? `“${value}”` : JSON.stringify(value);
  return { message: t.rejectedValue(shown) };
}

/** The rejected values meant for `field` or for one of its parts. */
export function rejectedWithin(rejected: readonly RejectedValue[], field: string): RejectedValue[] {
  return rejected.filter(
    (rejection) => rejection.field === field || rejection.field.startsWith(`${field}.`),
  );
}

/** Whether a change of the form value `changed` concerns `field`: the same one, a part of it, or the block it belongs to. */
export function changeConcerns(changed: string, field: JsonApplicationField): boolean {
  return changed === field || field.startsWith(`${changed}.`) || changed.startsWith(`${field}.`);
}

type FormControl = FieldPath<CreateApplicationInput>;

// Every control a rejected value can be shown at, in the order the form shows them.
const controlsInFormOrder: readonly FormControl[] = [
  ...applicationFormFields,
  ...salaryAmounts.flatMap((amount) => [
    `salary.${amount}.min` as const,
    `salary.${amount}.max` as const,
  ]),
  "salary.currency",
  "salary.period",
  ...contactParts.map((part) => `contact.${part}` as const),
];

/** The control a rejected value is shown at, where focus goes to point it out. */
export function pastedValueControl(field: JsonApplicationField): FormControl {
  if (field === "salary") {
    return "salary.advertised.min";
  }
  if (field === "contact") {
    return "contact.name";
  }
  const amount = salaryAmounts.find((candidate) => field === `salary.${candidate}`);
  return amount ? `salary.${amount}.min` : field;
}

/** The control of the rejected value the form shows first. */
export function firstPastedValueControl(
  rejected: readonly RejectedValue[],
): FormControl | undefined {
  const controls = rejected.map(({ field }) => pastedValueControl(field));
  return controlsInFormOrder.find((control) => controls.includes(control));
}
