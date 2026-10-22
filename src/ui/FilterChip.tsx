"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { awaitingHydrationClass, useHydrated } from "@/ui/hooks/use-hydrated";

/** A filter that is on or off; `href` is the list with it switched the other way. */
export type FilterToggle = {
  on: boolean;
  href: string;
  /** Items of the whole list it would let through. */
  count: number;
};

export const filterChipClass =
  "inline-flex h-7.5 items-center gap-1.75 rounded-full border px-2.75 text-[13px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
export const filterChipOnClass = "border-foreground bg-foreground text-chip-on-fg";
export const filterChipOffClass = "border-border text-foreground hover:border-input";

/** A pressed or unpressed button that leads to the list with its filter switched. */
export function FilterChip({ on, href, count, children }: FilterToggle & { children: ReactNode }) {
  const router = useRouter();
  const hydrated = useHydrated();

  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={!hydrated}
      onClick={() => router.push(href, { scroll: false })}
      className={cn(
        filterChipClass,
        on ? filterChipOnClass : filterChipOffClass,
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
