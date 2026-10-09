"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { longWaitDays } from "@/domain/application/list";
import type { ApplicationStatus } from "@/domain/application/model";
import { cn } from "@/lib/utils";
import { awaitingHydrationClass, useHydrated } from "@/ui/hooks/use-hydrated";
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

export type ApplicationFiltersProps = {
  /** One per status the view holds, in process order. */
  statuses: readonly StatusFilter[];
  /** Null while no application of the view waits long, and the filter is off. */
  waitingLong: FilterToggle | null;
  /** The list without any filter; null while none is on. */
  clearHref: string | null;
};

const t = messages.applications;

export function ApplicationFilters({ statuses, waitingLong, clearHref }: ApplicationFiltersProps) {
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

function Chip({ on, href, count, children }: FilterToggle & { children: ReactNode }) {
  const router = useRouter();
  const hydrated = useHydrated();

  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={!hydrated}
      onClick={() => router.push(href, { scroll: false })}
      className={cn(
        "inline-flex h-7.5 items-center gap-1.75 rounded-full border px-2.75 text-[13px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        on
          ? "border-foreground bg-foreground text-chip-on-fg"
          : "border-border text-foreground hover:border-input",
        !hydrated && awaitingHydrationClass,
      )}
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
