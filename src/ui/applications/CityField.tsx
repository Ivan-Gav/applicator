"use client";

import type { AriaAttributes, Ref } from "react";
import type { CityMatch } from "@/domain/city/model";
import { cityMatchesSchema } from "@/domain/city/schema";
import { placeDetails } from "@/domain/city/search";
import { messages } from "@/ui/messages";
import { SuggestionField, type SuggestionSearch } from "@/ui/SuggestionField";

export type CityFieldProps = {
  id: string;
  ref?: Ref<HTMLInputElement>;
  /** The city the form holds, "" for none. */
  value: string;
  /** Answers with CityMatch[]. */
  search: SuggestionSearch;
  /** The text changed by typing. */
  onChange: (city: string) => void;
  /** A suggestion was picked. */
  onPick: (city: string, country: string) => void;
  onBlur?: () => void;
} & Pick<AriaAttributes, "aria-invalid" | "aria-describedby">;

const t = messages.applications.form.city;

const parseMatches = (answer: unknown) => cityMatchesSchema.parse(answer);

/**
 * A text field that suggests cities of the reference list as one types. Any
 * text is accepted; picking a suggestion also fills in its country.
 */
export function CityField({ onPick, ...field }: CityFieldProps) {
  return (
    <SuggestionField<CityMatch>
      {...field}
      parse={parseMatches}
      keyOf={(match) => match.id}
      listLabel={t.matches}
      announce={t.found}
      onPick={(match) => onPick(match.name, match.country)}
      renderSuggestion={(match, shownWith) => (
        <>
          <span className="font-medium">{t.option(match.name, match.matchedName)}</span>
          <span className="sr-only">,</span>{" "}
          <span className="block text-xs text-muted-foreground">
            {t.place(placeDetails(match, shownWith))}
          </span>
        </>
      )}
    />
  );
}
