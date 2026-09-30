"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { useForm } from "react-hook-form";
import { applicationStatuses, workModes } from "@/domain/application/model";
import {
  type CreateApplication,
  type CreateApplicationInput,
  type CreateApplicationRejection,
  createApplicationSchema,
} from "@/domain/application/schema";
import { startOfLocalDay } from "@/lib/date";
import { Alert, AlertDescription } from "@/ui/kit/alert";
import { Button } from "@/ui/kit/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/ui/kit/field";
import { Input } from "@/ui/kit/input";
import { NativeSelect, NativeSelectOption } from "@/ui/kit/native-select";
import { Textarea } from "@/ui/kit/textarea";
import { messages } from "@/ui/messages";
import { SalaryFields } from "./SalaryFields";
import {
  type ApplicationFormField,
  isApplicationFormField,
  isSalaryFormField,
} from "./application-form-fields";

export type ApplicationFormProps = {
  // Navigates away on success; resolves only with a rejection.
  createApplication: (input: CreateApplication) => Promise<CreateApplicationRejection>;
  cancelHref: string;
};

const t = messages.applications.form;

// An unselected option submits "", which the enum fields do not accept.
const blankAsNull = (value: unknown) => (value === "" ? null : value);

// The picked day starts in the browser's time zone. What is not a real day
// stays a string, for the schema to reject.
const dayAsInstant = (value: unknown) =>
  value === "" ? null : typeof value === "string" ? (startOfLocalDay(value) ?? value) : value;

export function ApplicationForm({ createApplication, cancelHref }: ApplicationFormProps) {
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const form = useForm<CreateApplicationInput, unknown, CreateApplication>({
    resolver: zodResolver(createApplicationSchema),
    defaultValues: {
      companyName: "",
      positionTitle: "",
      status: "draft",
      appliedAt: null,
      city: "",
      workMode: null,
      source: "",
      applicationUrl: "",
      notes: "",
      salary: {
        advertised: { min: null, max: null },
        estimated: { min: null, max: null },
        asked: { min: null, max: null },
        currency: "EUR",
        period: null,
      },
    },
  });
  const [salaryOpen, setSalaryOpen] = useState(false);
  const { errors, isSubmitting } = form.formState;
  const pending = saving || isSubmitting;
  const salaryShown = salaryOpen || errors.salary !== undefined;

  function showRejection({ invalidFields }: CreateApplicationRejection) {
    const shown = [
      ...invalidFields.filter(isApplicationFormField),
      ...invalidFields.filter(isSalaryFormField),
    ];
    for (const field of shown) {
      form.setError(field, { type: "server" });
    }
    if (shown.length < invalidFields.length) {
      setFailure(t.rejected);
    }
  }

  const submit = form.handleSubmit(
    (values) => {
      setFailure(null);
      startSaving(async () => {
        try {
          showRejection(await createApplication(values));
        } catch (error) {
          // A successful save redirects, and Next.js delivers that redirect here
          // as a thrown error.
          // unstable_rethrow hands these back to Next.js; only real failures pass.
          unstable_rethrow(error);
          setFailure(t.saveFailed);
        }
      });
    },
    (invalid) => {
      // Open before react-hook-form moves focus to the first error, which it
      // cannot do inside a closed <details>.
      if (invalid.salary) {
        flushSync(() => setSalaryOpen(true));
      }
    },
  );

  function describedBy(field: ApplicationFormField, hintId?: string) {
    const ids = [errors[field] ? `${field}-error` : undefined, hintId].filter(Boolean);
    return {
      "aria-invalid": errors[field] ? true : undefined,
      "aria-describedby": ids.length > 0 ? ids.join(" ") : undefined,
    } as const;
  }

  // Always this form's own wording, never the schema's message.
  function error(field: ApplicationFormField) {
    return (
      <FieldError
        id={`${field}-error`}
        errors={errors[field] ? [{ message: t.errors[field] }] : []}
      />
    );
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      noValidate
      className="flex max-w-xl flex-col gap-5"
    >
      <Field data-invalid={errors.companyName ? true : undefined}>
        <FieldLabel htmlFor="companyName">{t.labels.companyName}</FieldLabel>
        <Input
          id="companyName"
          autoComplete="organization"
          {...describedBy("companyName")}
          {...form.register("companyName")}
        />
        {error("companyName")}
      </Field>

      <Field data-invalid={errors.positionTitle ? true : undefined}>
        <FieldLabel htmlFor="positionTitle">{t.labels.positionTitle}</FieldLabel>
        <Input
          id="positionTitle"
          autoComplete="organization-title"
          {...describedBy("positionTitle")}
          {...form.register("positionTitle")}
        />
        {error("positionTitle")}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field data-invalid={errors.status ? true : undefined}>
          <FieldLabel htmlFor="status">{t.labels.status}</FieldLabel>
          <NativeSelect
            id="status"
            className="w-full"
            {...describedBy("status")}
            {...form.register("status")}
          >
            {applicationStatuses.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {messages.applications.status[status]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {error("status")}
        </Field>

        <Field data-invalid={errors.appliedAt ? true : undefined}>
          <FieldLabel htmlFor="appliedAt">{t.labels.appliedAt}</FieldLabel>
          <Input
            id="appliedAt"
            type="date"
            {...describedBy("appliedAt")}
            {...form.register("appliedAt", { setValueAs: dayAsInstant })}
          />
          {error("appliedAt")}
        </Field>

        <Field data-invalid={errors.city ? true : undefined}>
          <FieldLabel htmlFor="city">{t.labels.city}</FieldLabel>
          <Input
            id="city"
            autoComplete="address-level2"
            {...describedBy("city")}
            {...form.register("city")}
          />
          {error("city")}
        </Field>

        <Field data-invalid={errors.workMode ? true : undefined}>
          <FieldLabel htmlFor="workMode">{t.labels.workMode}</FieldLabel>
          <NativeSelect
            id="workMode"
            className="w-full"
            {...describedBy("workMode")}
            {...form.register("workMode", { setValueAs: blankAsNull })}
          >
            <NativeSelectOption value="">{t.workModeUnset}</NativeSelectOption>
            {workModes.map((workMode) => (
              <NativeSelectOption key={workMode} value={workMode}>
                {messages.applications.workMode[workMode]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {error("workMode")}
        </Field>
      </div>

      <Field data-invalid={errors.source ? true : undefined}>
        <FieldLabel htmlFor="source">{t.labels.source}</FieldLabel>
        <Input id="source" {...describedBy("source", "source-hint")} {...form.register("source")} />
        <FieldDescription id="source-hint">{t.sourceHint}</FieldDescription>
        {error("source")}
      </Field>

      <Field data-invalid={errors.applicationUrl ? true : undefined}>
        <FieldLabel htmlFor="applicationUrl">{t.labels.applicationUrl}</FieldLabel>
        <Input
          id="applicationUrl"
          type="url"
          inputMode="url"
          {...describedBy("applicationUrl")}
          {...form.register("applicationUrl")}
        />
        {error("applicationUrl")}
      </Field>

      <Field data-invalid={errors.notes ? true : undefined}>
        <FieldLabel htmlFor="notes">{t.labels.notes}</FieldLabel>
        <Textarea id="notes" rows={4} {...describedBy("notes")} {...form.register("notes")} />
        {error("notes")}
      </Field>

      <SalaryFields
        register={form.register}
        errors={errors.salary}
        open={salaryShown}
        onOpenChange={setSalaryOpen}
      />

      {failure && (
        <Alert variant="destructive">
          <AlertDescription>
            <p className="text-foreground">{failure}</p>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? t.saving : t.submit}
        </Button>
        <Button asChild variant="outline">
          <Link href={cancelHref}>{t.cancel}</Link>
        </Button>
      </div>
    </form>
  );
}
