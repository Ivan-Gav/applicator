"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { SearchIcon } from "@/ui/icons/SearchIcon";
import { Input } from "@/ui/kit/input";

/** Where a list searches, and what it searches for now. */
export type ListSearchQuery = {
  /** The list's path; the search is a GET request to it. */
  action: string;
  /** The search parameter's name. */
  name: string;
  /** The search the URL carries now. */
  value: string;
  /** The rest of the list's state, sent along so a search keeps it. */
  hiddenFields: ReadonlyArray<readonly [string, string]>;
};

export type ListSearchProps = ListSearchQuery & {
  /** The field's accessible name. */
  label: string;
  placeholder: string;
};

const typingPause = 300;

/**
 * Searches a list as one types, after a pause, or at once on Enter. Without
 * script it is a plain GET form.
 */
export function ListSearch({
  action,
  name,
  value: search,
  hiddenFields,
  label,
  placeholder,
}: ListSearchProps) {
  const router = useRouter();
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const pause = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [value, setValue] = useState(search);
  // The search this field last sent, and the one the URL carried at the last render.
  const [sent, setSent] = useState(search);
  const [carried, setCarried] = useState(search);
  // A change in the URL that this field did not send came from elsewhere, such
  // as "Clear filters" or the back button, and replaces the text.
  if (search !== carried) {
    setCarried(search);
    if (search !== sent) {
      setSent(search);
      setValue(search);
    }
  }
  const blank = value.trim() === "";

  useEffect(() => () => clearTimeout(pause.current), []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearTimeout(pause.current);
    setSent(blank ? "" : value);
    // Every field here is text; FormData only types them as possibly files.
    const fields = [...new FormData(event.currentTarget)].filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    );
    const query = new URLSearchParams(fields).toString();
    router.replace(query ? `${action}?${query}` : action, { scroll: false });
  }

  return (
    <form ref={form} role="search" action={action} method="get" onSubmit={submit}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.75 size-3.75 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type="search"
          // A blank search stays out of the URL.
          name={blank ? undefined : name}
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          className="h-9 rounded-[3px] bg-card pr-3 pl-8.5 text-sm md:text-sm dark:bg-card"
          onChange={(event) => {
            setValue(event.target.value);
            clearTimeout(pause.current);
            pause.current = setTimeout(() => form.current?.requestSubmit(), typingPause);
          }}
        />
      </div>
      {hiddenFields.map(([field, fieldValue]) => (
        // A parameter may repeat, such as one per city.
        <input key={`${field}=${fieldValue}`} type="hidden" name={field} value={fieldValue} />
      ))}
    </form>
  );
}
