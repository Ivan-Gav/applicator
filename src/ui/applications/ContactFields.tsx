"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { type ContactPart, contactParts } from "@/domain/application/model";
import type { CreateApplicationInput } from "@/domain/application/schema";
import { Field, FieldError, FieldLabel } from "@/ui/kit/field";
import { Input } from "@/ui/kit/input";
import { messages } from "@/ui/messages";
import { panel, panelSummary } from "./panel";

export type ContactFieldsProps = {
  register: UseFormRegister<CreateApplicationInput>;
  errors: FieldErrors<CreateApplicationInput>["contact"];
  /** Shown beside the title, e.g. "Jane Doe · Recruiter"; empty for none. */
  summary: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const t = messages.applications.form.contact;

// Addresses and numbers read better in a fixed-width face.
const mono = "font-mono text-[13px] md:text-[13px]";

const inputProps = {
  name: { autoComplete: "off" },
  role: { autoComplete: "off" },
  email: { type: "email", inputMode: "email", autoComplete: "off", className: mono },
  phone: { type: "tel", inputMode: "tel", autoComplete: "off", className: mono },
  url: { type: "url", inputMode: "url", autoComplete: "off", className: mono },
} as const satisfies Record<ContactPart, object>;

export function ContactFields({
  register,
  errors,
  summary,
  open,
  onOpenChange,
}: ContactFieldsProps) {
  return (
    <details
      open={open}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
      className={panel}
    >
      <summary className={panelSummary}>
        <span>{t.title}</span>
        {summary && (
          <span className="text-[13px] font-normal text-muted-foreground">{summary}</span>
        )}
      </summary>
      <div className="mt-3 grid gap-3.5 sm:grid-cols-2">
        {contactParts.map((part) => {
          const id = `contact-${part}`;
          const errorId = `${id}-error`;
          const invalid = errors?.[part] !== undefined;
          return (
            <Field
              key={part}
              data-invalid={invalid ? true : undefined}
              className={part === "url" ? "sm:col-span-2" : undefined}
            >
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
