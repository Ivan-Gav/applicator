"use client";

import {
  type AriaAttributes,
  type KeyboardEvent,
  type Ref,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { CityMatch } from "@/domain/city/model";
import { cityMatchesSchema } from "@/domain/city/schema";
import { placeDetails } from "@/domain/city/search";
import { cn } from "@/lib/utils";
import { Input } from "@/ui/kit/input";
import { messages } from "@/ui/messages";

export type CitySearch = {
  /** Where cities are searched: a GET request answering with CityMatch[]. */
  action: string;
  /** The search parameter's name. */
  name: string;
};

export type CityFieldProps = {
  id: string;
  ref?: Ref<HTMLInputElement>;
  /** The city the form holds, "" for none. */
  value: string;
  search: CitySearch;
  /** The text changed by typing. */
  onChange: (city: string) => void;
  /** A suggestion was picked. */
  onPick: (city: string, country: string) => void;
  onBlur?: () => void;
} & Pick<AriaAttributes, "aria-invalid" | "aria-describedby">;

const t = messages.applications.form.city;
const typingPause = 200;
const steps: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };

/**
 * A text field that suggests cities of the reference list as one types. Any
 * text is accepted; picking a suggestion also fills in its country.
 */
export function CityField({
  id,
  ref,
  value,
  search,
  onChange,
  onPick,
  onBlur,
  ...aria
}: CityFieldProps) {
  const listId = useId();
  const [suggestions, setSuggestions] = useState<CityMatch[]>([]);
  const [active, setActive] = useState(0);
  const pause = useRef<ReturnType<typeof setTimeout>>(undefined);
  const request = useRef<AbortController>(undefined);
  const expanded = suggestions.length > 0;

  useEffect(
    () => () => {
      clearTimeout(pause.current);
      request.current?.abort();
    },
    [],
  );

  // Drops the search under way and the suggestions shown.
  function close() {
    clearTimeout(pause.current);
    request.current?.abort();
    setSuggestions([]);
  }

  async function suggest(query: string) {
    const controller = new AbortController();
    request.current = controller;
    try {
      const url = new URL(search.action, window.location.href);
      url.searchParams.set(search.name, query);
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`City search answered ${response.status}`);
      }
      setSuggestions(cityMatchesSchema.parse(await response.json()));
      setActive(0);
    } catch {
      // Suggestions only help; without them the typed text stands.
    }
  }

  function type(text: string) {
    onChange(text);
    close();
    const query = text.trim();
    if (query !== "") {
      pause.current = setTimeout(() => void suggest(query), typingPause);
    }
  }

  function pick(match: CityMatch) {
    close();
    onPick(match.name, match.country);
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    const step = steps[event.key];
    const highlighted = suggestions[active];
    if (step !== undefined && expanded) {
      event.preventDefault();
      setActive((active + step + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" && highlighted) {
      // Picks instead of submitting the form.
      event.preventDefault();
      pick(highlighted);
    } else if (event.key === "Escape" && expanded) {
      event.preventDefault();
      close();
    }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        ref={ref}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={value}
        onChange={(event) => type(event.target.value)}
        onKeyDown={keyDown}
        onBlur={() => {
          close();
          onBlur?.();
        }}
        {...aria}
      />
      <p aria-live="polite" className="sr-only">
        {expanded ? t.found(suggestions.length) : ""}
      </p>
      <ul
        id={listId}
        role="listbox"
        aria-label={t.matches}
        hidden={!expanded}
        className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-[3px] border bg-popover p-1 text-sm text-popover-foreground shadow-md"
      >
        {suggestions.map((match, index) => (
          // The input keeps focus and the keyboard; a click only picks.
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events
          <li
            key={match.id}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === active}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => pick(match)}
            className={cn(
              "cursor-default rounded-xs px-2 py-1.5",
              index === active && "bg-accent text-accent-foreground",
            )}
          >
            <span className="font-medium">{t.option(match.name, match.matchedName)}</span>
            <span className="sr-only">,</span>{" "}
            <span className="block text-xs text-muted-foreground">
              {t.place(placeDetails(match, suggestions))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
