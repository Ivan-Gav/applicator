"use client";

import type { AriaAttributes, Ref } from "react";
import { sourceSuggestionsSchema } from "@/domain/source/schema";
import { messages } from "@/ui/messages";
import { SuggestionField, type SuggestionSearch } from "@/ui/SuggestionField";

export type SourceFieldProps = {
  id: string;
  ref?: Ref<HTMLInputElement>;
  /** The source the form holds, "" for none. */
  value: string;
  /** Answers with a list of sources. */
  search: SuggestionSearch;
  /** The text changed by typing or by picking a suggestion. */
  onChange: (source: string) => void;
  onBlur?: () => void;
} & Pick<AriaAttributes, "aria-invalid" | "aria-describedby">;

const t = messages.applications.form.source;

const parseSources = (answer: unknown) => sourceSuggestionsSchema.parse(answer);

/**
 * A text field that lists the known sources when opened, like a select, and
 * suggests known and already used ones as one types. Any text is accepted.
 */
export function SourceField({ onChange, ...field }: SourceFieldProps) {
  return (
    <SuggestionField<string>
      {...field}
      parse={parseSources}
      keyOf={(source) => source}
      listLabel={t.matches}
      announce={t.found}
      listsOnOpen
      onChange={onChange}
      onPick={onChange}
      renderSuggestion={(source) => source}
    />
  );
}
