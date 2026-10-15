"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  type ApplicationJsonReading,
  type JsonReadOutcome,
  readApplicationJson,
} from "@/domain/application/json";
import { Button } from "@/ui/kit/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/ui/kit/field";
import { Textarea } from "@/ui/kit/textarea";
import { messages } from "@/ui/messages";
import { panel, panelSummary } from "./panel";

export type JsonPasteProps = {
  /** Receives what the pasted object yields; never called for text that is not one object. */
  onRead: (reading: ApplicationJsonReading) => void;
  /** Where the format is described. */
  formatHref: string;
};

const t = messages.applications.form.paste;
const id = "application-json";
const hintId = `${id}-hint`;
const errorId = `${id}-error`;
const example = t.example;
const exampleJson = JSON.stringify(example.value, null, 2);
const exampleHref = `data:application/json;charset=utf-8,${encodeURIComponent(exampleJson)}`;
const linkLike = "h-auto px-0 text-[13px]";

async function copyExample() {
  try {
    await navigator.clipboard.writeText(exampleJson);
    toast.success(example.copied);
  } catch {
    // No clipboard outside a secure context, or permission refused.
    toast.error(example.copyFailed);
  }
}

export function JsonPaste({ onRead, formatHref }: JsonPasteProps) {
  const [text, setText] = useState("");
  const [outcome, setOutcome] = useState<JsonReadOutcome | null>(null);
  const failure = outcome?.ok === false ? outcome.failure : null;
  const reading = outcome?.ok ? outcome.reading : null;

  function fillIn() {
    const read = readApplicationJson(text);
    setOutcome(read);
    if (read.ok) {
      onRead(read.reading);
    }
  }

  return (
    <details className={panel}>
      <summary className={panelSummary}>
        <span>{t.title}</span>
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="flex flex-wrap items-center gap-2 text-[13px]">
          <span>{example.label}</span>
          <Button
            type="button"
            variant="link"
            size="xs"
            className={linkLike}
            aria-label={example.copyLabel}
            onClick={() => void copyExample()}
          >
            {example.copy}
          </Button>
          <span aria-hidden>|</span>
          <Button asChild variant="link" size="xs" className={linkLike}>
            <a href={exampleHref} download={example.fileName} aria-label={example.downloadLabel}>
              {example.download}
            </a>
          </Button>
        </p>
        <Field data-invalid={failure ? true : undefined}>
          <FieldLabel htmlFor={id}>{t.label}</FieldLabel>
          <Textarea
            id={id}
            rows={6}
            spellCheck={false}
            className="font-mono text-[13px] md:text-[13px]"
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-invalid={failure ? true : undefined}
            aria-describedby={failure ? `${errorId} ${hintId}` : hintId}
          />
          <FieldDescription id={hintId}>
            {t.hint}{" "}
            <a href={formatHref} target="_blank" rel="noreferrer">
              {t.format}
            </a>
          </FieldDescription>
          <FieldError id={errorId} errors={failure ? [{ message: t.failure[failure] }] : []} />
        </Field>
        <div>
          <Button type="button" variant="outline" onClick={fillIn}>
            {t.apply}
          </Button>
        </div>
        <div role="status" className="flex flex-col gap-1 text-[13px]">
          {reading && (
            <>
              <p>{reading.rejected.length > 0 ? t.rejected(reading.rejected.length) : t.filled}</p>
              {reading.unknownKeys.length > 0 && <p>{t.unknownKeys(reading.unknownKeys)}</p>}
            </>
          )}
        </div>
      </div>
    </details>
  );
}
