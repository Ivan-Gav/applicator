"use client";

import {
  type AriaAttributes,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/ui/kit/input";

export type SuggestionSearch = {
  /** Where suggestions are searched: a GET request answering with a JSON list. */
  action: string;
  /** The search parameter's name. */
  name: string;
};

export type SuggestionFieldProps<Suggestion> = {
  id: string;
  ref?: Ref<HTMLInputElement>;
  /** The text the form holds, "" for none. */
  value: string;
  search: SuggestionSearch;
  /** The search's answer as suggestions; throws on any other shape. */
  parse: (answer: unknown) => Suggestion[];
  /** Unique among the suggestions of one answer. */
  keyOf: (suggestion: Suggestion) => string | number;
  /** One suggestion as listed, beside the others shown with it. */
  renderSuggestion: (suggestion: Suggestion, shownWith: readonly Suggestion[]) => ReactNode;
  /** The suggestion list's accessible name. */
  listLabel: string;
  /** Read out when suggestions arrive. */
  announce: (count: number) => string;
  /**
   * Whether a click or ArrowDown opens the suggestions of a blank search, as a
   * select would, and emptying the text shows them again.
   */
  listsOnOpen?: boolean;
  /** The text changed by typing. */
  onChange: (text: string) => void;
  /** A suggestion was picked. */
  onPick: (suggestion: Suggestion) => void;
  onBlur?: () => void;
} & Pick<AriaAttributes, "aria-invalid" | "aria-describedby">;

const typingPause = 200;
const steps: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };

/** A text field that suggests values from a search as one types. Any text is accepted. */
export function SuggestionField<Suggestion>({
  id,
  ref,
  value,
  search,
  parse,
  keyOf,
  renderSuggestion,
  listLabel,
  announce,
  listsOnOpen = false,
  onChange,
  onPick,
  onBlur,
  ...aria
}: SuggestionFieldProps<Suggestion>) {
  const listId = useId();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
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
        throw new Error(`Suggestion search answered ${response.status}`);
      }
      setSuggestions(parse(await response.json()));
      setActive(0);
    } catch {
      // Suggestions only help; without them the typed text stands.
    }
  }

  function type(text: string) {
    onChange(text);
    close();
    const query = text.trim();
    if (query !== "" || listsOnOpen) {
      pause.current = setTimeout(() => void suggest(query), typingPause);
    }
  }

  // Lists the suggestions of a blank search, whatever the text.
  function open() {
    if (listsOnOpen && !expanded) {
      close();
      void suggest("");
    }
  }

  function pick(suggestion: Suggestion) {
    close();
    onPick(suggestion);
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    const step = steps[event.key];
    const highlighted = suggestions[active];
    if (event.key === "ArrowDown" && listsOnOpen && !expanded) {
      event.preventDefault();
      open();
    } else if (step !== undefined && expanded) {
      event.preventDefault();
      setActive((active + step + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" && highlighted !== undefined) {
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
        onClick={open}
        onBlur={() => {
          close();
          onBlur?.();
        }}
        {...aria}
      />
      <p aria-live="polite" className="sr-only">
        {expanded ? announce(suggestions.length) : ""}
      </p>
      <ul
        id={listId}
        role="listbox"
        aria-label={listLabel}
        hidden={!expanded}
        className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-[3px] border bg-popover p-1 text-sm text-popover-foreground shadow-md"
      >
        {suggestions.map((suggestion, index) => (
          // The input keeps focus and the keyboard; a click only picks.
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events
          <li
            key={keyOf(suggestion)}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === active}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => pick(suggestion)}
            className={cn(
              "cursor-default rounded-xs px-2 py-1.5",
              index === active && "bg-accent text-accent-foreground",
            )}
          >
            {renderSuggestion(suggestion, suggestions)}
          </li>
        ))}
      </ul>
    </div>
  );
}
