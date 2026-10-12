"use client";

import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useTransition } from "react";
import { longWaitDays } from "@/domain/application/list";
import type { ApplicationStatus } from "@/domain/application/model";
import { cn } from "@/lib/utils";
import { awaitingHydrationClass, useHydrated } from "@/ui/hooks/use-hydrated";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/ui/kit/dropdown-menu";
import { messages } from "@/ui/messages";
import { StatusSwatch } from "./StatusSwatch";

/** A filter that is on or off; `href` is the list with it switched the other way. */
export type FilterToggle = {
  on: boolean;
  href: string;
  /** Applications of the whole view it would let through. */
  count: number;
};

export type StatusFilter = FilterToggle & {
  status: ApplicationStatus;
};

export type CityFilter = FilterToggle & {
  city: string;
};

export type ApplicationFiltersProps = {
  /** One per status the view holds, in process order. */
  statuses: readonly StatusFilter[];
  /** Null while no application of the view waits long, and the filter is off. */
  waitingLong: FilterToggle | null;
  /** The cities of the view's own applications; null while none has a city, and none is on. */
  cities: readonly CityFilter[] | null;
  /** The list without any filter; null while none is on. */
  clearHref: string | null;
};

const t = messages.applications;
const chip =
  "inline-flex h-7.5 items-center gap-1.75 rounded-full border px-2.75 text-[13px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const chipOn = "border-foreground bg-foreground text-chip-on-fg";
const chipOff = "border-border text-foreground hover:border-input";

export function ApplicationFilters({
  statuses,
  waitingLong,
  cities,
  clearHref,
}: ApplicationFiltersProps) {
  return (
    <div role="group" aria-label={t.filters.label} className="flex flex-wrap items-center gap-2">
      {statuses.map(({ status, count, on, href }) => (
        <Chip key={status} on={on} href={href} count={count}>
          <StatusSwatch status={status} />
          {t.status[status]}
        </Chip>
      ))}
      {waitingLong && (
        <>
          <span aria-hidden className="mx-1 h-5 w-px bg-border" />
          <Chip {...waitingLong}>{t.filters.waitingLong(longWaitDays)}</Chip>
        </>
      )}
      {cities && (
        <>
          <span aria-hidden className="mx-1 h-5 w-px bg-border" />
          <CityMenu cities={cities} />
        </>
      )}
      {clearHref && (
        <Link
          href={clearHref}
          scroll={false}
          className="ml-1 text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {t.filters.clear}
        </Link>
      )}
    </div>
  );
}

/** Several cities may be on at once; the menu stays open while they are switched. */
function CityMenu({ cities }: { cities: readonly CityFilter[] }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const chosen = cities.filter(({ on }) => on).map(({ city }) => city);
  // Each href holds the cities on now, so the next switch waits for the list this one leads to.
  const [switching, startSwitching] = useTransition();

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild disabled={!hydrated}>
        <button
          type="button"
          className={cn(
            chip,
            chosen.length > 0 ? chipOn : chipOff,
            !hydrated && awaitingHydrationClass,
          )}
        >
          {t.filters.cities(chosen)}
          <ChevronDownIcon aria-hidden className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-auto min-w-48">
        {cities.map(({ city, count, on, href }) => (
          <DropdownMenuCheckboxItem
            key={city}
            checked={on}
            disabled={switching}
            onSelect={(event) => {
              event.preventDefault();
              startSwitching(() => router.push(href, { scroll: false }));
            }}
          >
            {city} <span className="ml-auto font-mono text-xs text-muted-foreground">{count}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Chip({ on, href, count, children }: FilterToggle & { children: ReactNode }) {
  const router = useRouter();
  const hydrated = useHydrated();

  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={!hydrated}
      onClick={() => router.push(href, { scroll: false })}
      className={cn(chip, on ? chipOn : chipOff, !hydrated && awaitingHydrationClass)}
    >
      {children}{" "}
      <span
        className={cn("font-mono text-xs", on ? "text-chip-on-count" : "text-muted-foreground")}
      >
        {count}
      </span>
    </button>
  );
}
