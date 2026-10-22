"use client";

import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { longWaitDays } from "@/domain/application/list";
import type { ApplicationStatus } from "@/domain/application/model";
import { cn } from "@/lib/utils";
import {
  FilterChip,
  type FilterToggle,
  filterChipClass,
  filterChipOffClass,
  filterChipOnClass,
} from "@/ui/FilterChip";
import { awaitingHydrationClass, useHydrated } from "@/ui/hooks/use-hydrated";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/ui/kit/dropdown-menu";
import { messages } from "@/ui/messages";
import { StatusSwatch } from "./StatusSwatch";

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

export function ApplicationFilters({
  statuses,
  waitingLong,
  cities,
  clearHref,
}: ApplicationFiltersProps) {
  return (
    <div role="group" aria-label={t.filters.label} className="flex flex-wrap items-center gap-2">
      {statuses.map(({ status, count, on, href }) => (
        <FilterChip key={status} on={on} href={href} count={count}>
          <StatusSwatch status={status} />
          {t.status[status]}
        </FilterChip>
      ))}
      {waitingLong && (
        <>
          <span aria-hidden className="mx-1 h-5 w-px bg-border" />
          <FilterChip {...waitingLong}>{t.filters.waitingLong(longWaitDays)}</FilterChip>
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
            filterChipClass,
            chosen.length > 0 ? filterChipOnClass : filterChipOffClass,
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
