"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { type ContactPart, contactParts } from "@/domain/application/model";
import type { CreateApplicationInput } from "@/domain/application/schema";
import { Field, FieldError, FieldLabel } from "@/ui/kit/field";
import { Input } from "@/ui/kit/input";
import { messages } from "@/ui/messages";

export type ContactFieldsProps = {
  register: UseFormRegister<CreateApplicationInput>;
  errors: FieldErrors<CreateApplicationInput>["contact"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const t = messages.applications.form.contact;

const inputProps = {
  name: { autoComplete: "off" },
  role: { autoComplete: "off" },
  email: { type: "email", inputMode: "email", autoComplete: "off" },
  phone: { type: "tel", inputMode: "tel", autoComplete: "off" },
  url: { type: "url", inputMode: "url", autoComplete: "off" },
} as const satisfies Record<ContactPart, object>;

export function ContactFields({ register, errors, open, onOpenChange }: ContactFieldsProps) {
  return (
    <details
      open={open}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
      className="rounded-lg border px-4 py-3"
    >
      <summary className="cursor-pointer font-medium">{t.title}</summary>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        {contactParts.map((part) => {
          const id = `contact-${part}`;
          const errorId = `${id}-error`;
          const invalid = errors?.[part] !== undefined;
          return (
            <Field key={part} data-invalid={invalid ? true : undefined}>
              <FieldLabel htmlFor={id}>{t.labels[part]}</FieldLabel>
              <Input
                id={id}
                aria-invalid={invalid ? true : undefined}
                aria-describedby={invalid ? errorId : undefined}
                {...inputProps[part]}
                {...register(`contact.${part}`)}
              />
              <FieldError id={errorId} errors={invalid ? [{ message: t.errors[part] }] : []} />
            </Field>
          );
        })}
      </div>
    </details>
  );
}
