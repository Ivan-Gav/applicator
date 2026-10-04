"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  type Application,
  applicationStatuses,
  channels,
  seniorities,
  workModes,
} from "@/domain/application/model";
import {
  type ApplicationRejection,
  type CreateApplication,
  type CreateApplicationInput,
  createApplicationSchema,
} from "@/domain/application/schema";
import { startOfLocalDay } from "@/lib/date";
import { Alert, AlertDescription } from "@/ui/kit/alert";
import { Button } from "@/ui/kit/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/ui/kit/field";
import { Input } from "@/ui/kit/input";
import { NativeSelect, NativeSelectOption } from "@/ui/kit/native-select";
import { awaitingHydrationClass, useHydrated } from "@/ui/hooks/use-hydrated";
import { Textarea } from "@/ui/kit/textarea";
import { messages } from "@/ui/messages";
import { ContactFields } from "./ContactFields";
import { SalaryFields } from "./SalaryFields";
import {
  type ApplicationFormField,
  isApplicationFormField,
  isSalaryFormField,
} from "./application-form-fields";
import { applicationFormValues, hasContact, hasSalary } from "./application-form-values";

export type ApplicationFormProps = {
  /**
   * Stores the input. Resolves with the rejected fields, none once an edit is
   * saved; a new application navigates away instead.
   */
  save: (input: CreateApplication) => Promise<ApplicationRejection>;
  backHref: string;
  /** The application to edit; without it the form creates a new one. */
  application?: Application;
};

const t = messages.applications.form;

// An unselected option submits "", which the enum fields do not accept.
const blankAsNull = (value: unknown) => (value === "" ? null : value);

// The picked day starts in the browser's time zone. What is not a real day
// stays a string, for the schema to reject.
const dayAsInstant = (value: unknown) =>
  value === "" ? null : typeof value === "string" ? (startOfLocalDay(value) ?? value) : value;

export function ApplicationForm({ save, backHref, application }: ApplicationFormProps) {
  const editing = application !== undefined;
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const hydrated = useHydrated();
  const form = useForm<CreateApplicationInput, unknown, CreateApplication>({
    resolver: zodResolver(createApplicationSchema),
    defaultValues: applicationFormValues(application),
  });
  const [salaryOpen, setSalaryOpen] = useState(application ? hasSalary(application.salary) : false);
  const [contactOpen, setContactOpen] = useState(
    application ? hasContact(application.contact) : false,
  );
  const { errors, isSubmitting, isDirty } = form.formState;
  const pending = saving || isSubmitting;
  // An edit with nothing changed has nothing to save.
  const unchanged = editing && !isDirty;
  const salaryShown = salaryOpen || errors.salary !== undefined;
  const contactShown = contactOpen || errors.contact !== undefined;

  function showRejection({ invalidFields }: ApplicationRejection) {
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
      const submitted = form.getValues();
      startSaving(async () => {
        try {
          const rejection = await save(values);
          showRejection(rejection);
          if (editing && rejection.invalidFields.length === 0) {
            // What was saved becomes the baseline; edits typed meanwhile stay.
            form.reset(submitted, { keepValues: true });
            toast.success(t.saved);
          }
        } catch (error) {
          // A successful save of a new application redirects, and Next.js
          // delivers that redirect here as a thrown error.
          // unstable_rethrow hands these back to Next.js; only real failures pass.
          unstable_rethrow(error);
          setFailure(t.saveFailed);
        }
      });
    },
    (invalid) => {
      // Open before react-hook-form moves focus to the first error, which it
      // cannot do inside a closed <details>.
      flushSync(() => {
        if (invalid.salary) {
          setSalaryOpen(true);
        }
        if (invalid.contact) {
          setContactOpen(true);
        }
      });
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

      <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
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

        <Field data-invalid={errors.seniority ? true : undefined}>
          <FieldLabel htmlFor="seniority">{t.labels.seniority}</FieldLabel>
          <NativeSelect
            id="seniority"
            className="w-full"
            {...describedBy("seniority")}
            {...form.register("seniority", { setValueAs: blankAsNull })}
          >
            <NativeSelectOption value="">{t.seniorityUnset}</NativeSelectOption>
            {seniorities.map((seniority) => (
              <NativeSelectOption key={seniority} value={seniority}>
                {messages.applications.seniority[seniority]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {error("seniority")}
        </Field>
      </div>

      {!editing && (
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
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-3">
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

        <Field data-invalid={errors.country ? true : undefined}>
          <FieldLabel htmlFor="country">{t.labels.country}</FieldLabel>
          <Input
            id="country"
            autoComplete="country-name"
            {...describedBy("country")}
            {...form.register("country")}
          />
          {error("country")}
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

      <div className="grid gap-5 sm:grid-cols-2">
        <Field data-invalid={errors.channel ? true : undefined}>
          <FieldLabel htmlFor="channel">{t.labels.channel}</FieldLabel>
          <NativeSelect
            id="channel"
            className="w-full"
            {...describedBy("channel")}
            {...form.register("channel")}
          >
            {channels.map((channel) => (
              <NativeSelectOption key={channel} value={channel}>
                {messages.applications.channel[channel]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {error("channel")}
        </Field>

        <Field data-invalid={errors.source ? true : undefined}>
          <FieldLabel htmlFor="source">{t.labels.source}</FieldLabel>
          <Input
            id="source"
            {...describedBy("source", "source-hint")}
            {...form.register("source")}
          />
          <FieldDescription id="source-hint">{t.sourceHint}</FieldDescription>
          {error("source")}
        </Field>
      </div>

      <Field data-invalid={errors.sourceUrl ? true : undefined}>
        <FieldLabel htmlFor="sourceUrl">{t.labels.sourceUrl}</FieldLabel>
        <Input
          id="sourceUrl"
          type="url"
          inputMode="url"
          {...describedBy("sourceUrl")}
          {...form.register("sourceUrl")}
        />
        {error("sourceUrl")}
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

      <ContactFields
        register={form.register}
        errors={errors.contact}
        open={contactShown}
        onOpenChange={setContactOpen}
      />

      {failure && (
        <Alert variant="destructive">
          <AlertDescription>
            <p className="text-foreground">{failure}</p>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          disabled={pending || unchanged || !hydrated}
          className={hydrated ? undefined : awaitingHydrationClass}
        >
          {pending ? t.saving : editing ? t.saveChanges : t.submit}
        </Button>
        <Button asChild variant="outline">
          <Link href={backHref}>{messages.applications.back}</Link>
        </Button>
      </div>
    </form>
  );
}
