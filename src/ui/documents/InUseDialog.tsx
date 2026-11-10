"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { matchesCompanyOrPosition } from "@/domain/application/list";
import { StatusSwatch } from "@/ui/applications/StatusSwatch";
import { SearchIcon } from "@/ui/icons/SearchIcon";
import {
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/ui/kit/alert-dialog";
import { Input } from "@/ui/kit/input";
import { messages } from "@/ui/messages";
import type { DocumentUseRow } from "./document-row-data";

export type InUseDialogContentProps = {
  title: string;
  /** Newest application first; never empty. */
  uses: readonly DocumentUseRow[];
  onClose: () => void;
};

const t = messages.documents.inUseDialog;

// Above this many applications, the list can be filtered.
const unfilteredMost = 10;

/** Shown instead of the delete confirmation: the applications that hold the document. */
export function InUseDialogContent({ title, uses, onClose }: InUseDialogContentProps) {
  const filterId = useId();
  const [filter, setFilter] = useState("");
  const filterable = uses.length > unfilteredMost;
  const shown = filterable ? uses.filter((use) => matchesCompanyOrPosition(use, filter)) : uses;
  const filtering = filterable && filter.trim() !== "";

  return (
    <AlertDialogContent
      onOverlayClick={onClose}
      className="flex w-130 max-w-[calc(100vw-32px)] flex-col gap-3.5 p-5.5 data-[size=default]:max-w-[calc(100vw-32px)] data-[size=default]:sm:max-w-130"
    >
      <AlertDialogHeader>
        <AlertDialogTitle className="text-xl">{t.title}</AlertDialogTitle>
        <AlertDialogDescription className="text-sm leading-normal text-foreground">
          <b>{title}</b>
          {t.description(uses.length)}
        </AlertDialogDescription>
      </AlertDialogHeader>

      {filterable && (
        <div className="relative">
          <label htmlFor={filterId} className="sr-only">
            {t.filter}
          </label>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.75 size-3.75 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={filterId}
            type="search"
            value={filter}
            placeholder={t.filterPlaceholder}
            autoComplete="off"
            className="h-9 rounded-[3px] bg-card pr-3 pl-8.5 text-sm md:text-sm dark:bg-card"
            onChange={(event) => setFilter(event.target.value)}
          />
        </div>
      )}

      <div className="flex justify-between gap-3 text-xs text-muted-foreground">
        <span aria-live="polite">
          {filtering ? t.countFiltered(shown.length, uses.length) : t.count(uses.length)}
        </span>
        <span>{t.versionColumn}</span>
      </div>
      <ul className="max-h-82.5 overflow-y-auto rounded-[4px] border bg-card [&>li+li]:border-t">
        {shown.length === 0 ? (
          <li className="px-3 py-3.5 text-sm text-muted-foreground">{t.nothingMatches}</li>
        ) : (
          shown.map((use) => (
            <li key={use.applicationId}>
              <Link
                href={use.href}
                className="flex items-center gap-3 px-3 py-2 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <StatusSwatch status={use.status} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-semibold">{use.companyName}</span>
                  <span className="truncate text-[13px] text-muted-foreground">
                    {t.summary(
                      messages.applications.status[use.status],
                      use.positionTitle,
                      use.archived,
                    )}
                  </span>
                </span>
                {use.version !== null && (
                  <span className="shrink-0 font-mono text-[13px] text-muted-foreground">
                    {use.version}
                  </span>
                )}
              </Link>
            </li>
          ))
        )}
      </ul>
      <p className="text-[13px] text-muted-foreground">{t.note}</p>

      <AlertDialogFooter>
        <AlertDialogCancel>{t.close}</AlertDialogCancel>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}
