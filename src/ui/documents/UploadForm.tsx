"use client";

import { type FormEvent, useId, useRef, useState, useTransition } from "react";
import {
  acceptedFormats,
  checkFileNameAndSize,
  maxDocumentFileBytes,
} from "@/domain/document/format";
import {
  type DocumentUploadOutcome,
  documentTypes,
  documentLanguages,
} from "@/domain/document/model";
import { documentFormField, documentTitleSchema } from "@/domain/document/schema";
import { formatFileSize } from "@/lib/file-size";
import { Button } from "@/ui/kit/button";
import { DialogClose, DialogFooter } from "@/ui/kit/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/ui/kit/field";
import { Input } from "@/ui/kit/input";
import { NativeSelect, NativeSelectOption } from "@/ui/kit/native-select";
import { messages } from "@/ui/messages";

export type UploadFormProps = {
  /** Stores the upload. Resolves with why it was refused, or no failure once stored. */
  submit: (form: FormData) => Promise<DocumentUploadOutcome>;
  onStored: () => void;
  /** Whether the form also asks for type, title and language, as a new document's does. */
  withDetails: boolean;
};

const d = messages.documents;
const t = d.form;
const f = documentFormField;

// What the browser can tell before uploading; the server checks again.
function fileProblem(file: File): string | null {
  const check = checkFileNameAndSize(file.name, file.size);
  return check.ok ? null : t.failure[check.failure];
}

// The file's name without its extension, as long as a title may be.
function titleOf(fileName: string): string {
  return fileName.replace(/\.[^.]*$/, "").slice(0, 200);
}

/** A file and its version label, and for a new document its type, title and language. */
export function UploadForm({ submit, onStored, withDetails }: UploadFormProps) {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [uploading, startUploading] = useTransition();
  const ids = {
    file: `${id}-file`,
    fileLabel: `${id}-file-label`,
    fileHint: `${id}-file-hint`,
    fileError: `${id}-file-error`,
    type: `${id}-type`,
    title: `${id}-title`,
    titleError: `${id}-title-error`,
    language: `${id}-language`,
    label: `${id}-label`,
    labelHint: `${id}-label-hint`,
  };

  function fileChosen(file: File | undefined) {
    setFileName(file?.name ?? null);
    setFileError(file ? fileProblem(file) : null);
    // A new document is named after its first file until the user names it.
    if (file && titleInput.current && titleInput.current.value.trim() === "") {
      titleInput.current.value = titleOf(file.name);
      setTitleError(null);
    }
  }

  function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const chosen = fileInput.current?.files?.[0] ?? null;
    if (chosen) {
      form.set(f.file, chosen);
    }
    const fileFailure = chosen ? fileProblem(chosen) : t.errors.fileMissing;
    const titleFailure =
      withDetails && !documentTitleSchema.safeParse(form.get(f.title)).success
        ? t.errors.title
        : null;
    setFileError(fileFailure);
    setTitleError(titleFailure);
    setFailure(null);
    if (fileFailure || titleFailure) {
      return;
    }
    startUploading(async () => {
      try {
        const outcome = await submit(form);
        if (outcome.failure) {
          setFailure(t.failure[outcome.failure]);
        } else {
          onStored();
        }
      } catch {
        setFailure(t.failed);
      }
    });
  }

  return (
    <form noValidate onSubmit={upload} className="flex min-w-0 flex-col gap-4">
      <Field data-invalid={fileError !== null}>
        <FieldLabel id={ids.fileLabel} htmlFor={ids.file}>
          {t.file}
        </FieldLabel>
        <div className="relative">
          {/* The control itself, visually hidden: browsers draw it in their own language and clip a long name. */}
          <input
            ref={fileInput}
            id={ids.file}
            name={f.file}
            type="file"
            accept={acceptedFormats}
            className="peer sr-only"
            aria-labelledby={ids.fileLabel}
            aria-invalid={fileError !== null}
            aria-describedby={fileError ? `${ids.fileHint} ${ids.fileError}` : ids.fileHint}
            onChange={(event) => fileChosen(event.currentTarget.files?.[0])}
          />
          {/* What the control shows, in the app's words; a click on it opens the file picker. */}
          <label
            htmlFor={ids.file}
            aria-hidden
            className="flex h-9 w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-[3px] border border-input bg-card px-1 text-sm transition-colors peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-aria-invalid:border-destructive"
          >
            {fileName === null ? (
              <span className="shrink-0 rounded-[3px] bg-muted px-2.5 py-1 text-[13px] font-medium">
                {t.chooseFile}
              </span>
            ) : (
              <span className="min-w-0 truncate px-1.5">{fileName}</span>
            )}
          </label>
        </div>
        <FieldDescription id={ids.fileHint}>
          {t.fileHint(formatFileSize(maxDocumentFileBytes))}
        </FieldDescription>
        {fileError && <FieldError id={ids.fileError}>{fileError}</FieldError>}
      </Field>

      {withDetails && (
        <>
          <Field>
            <FieldLabel htmlFor={ids.type}>{t.type}</FieldLabel>
            <NativeSelect id={ids.type} name={f.type} defaultValue={documentTypes[0]}>
              {documentTypes.map((type) => (
                <NativeSelectOption key={type} value={type}>
                  {d.type[type]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field data-invalid={titleError !== null}>
            <FieldLabel htmlFor={ids.title}>{t.title}</FieldLabel>
            <Input
              ref={titleInput}
              id={ids.title}
              name={f.title}
              maxLength={200}
              aria-invalid={titleError !== null}
              aria-describedby={titleError ? ids.titleError : undefined}
            />
            {titleError && <FieldError id={ids.titleError}>{titleError}</FieldError>}
          </Field>
          <Field>
            <FieldLabel htmlFor={ids.language}>{t.language}</FieldLabel>
            <NativeSelect id={ids.language} name={f.language} defaultValue="">
              <NativeSelectOption value="">{d.languageUnset}</NativeSelectOption>
              {documentLanguages.map((language) => (
                <NativeSelectOption key={language} value={language}>
                  {d.language[language]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </>
      )}

      <Field>
        <FieldLabel htmlFor={ids.label}>{t.label}</FieldLabel>
        <Input id={ids.label} name={f.label} maxLength={100} aria-describedby={ids.labelHint} />
        <FieldDescription id={ids.labelHint}>{t.labelHint}</FieldDescription>
      </Field>

      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={uploading}>
            {t.cancel}
          </Button>
        </DialogClose>
        <Button type="submit" disabled={uploading}>
          {uploading ? t.submitting : t.submit}
        </Button>
      </DialogFooter>
    </form>
  );
}
