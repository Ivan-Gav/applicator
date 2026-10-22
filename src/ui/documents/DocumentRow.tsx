"use client";

import { useState } from "react";
import { formatDay, isoDay } from "@/lib/date";
import { formatFileSize } from "@/lib/file-size";
import { cn } from "@/lib/utils";
import { TableCell, TableRow } from "@/ui/kit/table";
import { NativeSelect, NativeSelectOption } from "@/ui/kit/native-select";
import { messages } from "@/ui/messages";
import { aboveRowLinkClass, stretchedRowLinkClass } from "@/ui/row-link";
import {
  AddVersionDialog,
  type DocumentActionHandlers,
  DocumentRowActions,
} from "./DocumentActions";
import type { DocumentRowData } from "./document-row-data";
import { TypeTag } from "./TypeTag";

export type DocumentRowProps = {
  row: DocumentRowData;
  // The viewer's zone; dates show the day they fall on there.
  timeZone: string;
  actions: DocumentActionHandlers;
};

const t = messages.documents;
const muted = "block text-muted-foreground";
// Holds its place in rows without versions, so the add-version buttons line up.
const versionSelectWidth = "w-42.5";

/**
 * One document. The whole row opens the chosen version in a new tab; the
 * newest is chosen until another is picked, which only this view remembers.
 */
export function DocumentRow({ row, timeZone, actions }: DocumentRowProps) {
  const [newest] = row.versions;
  const [chosenId, setChosenId] = useState(newest?.id);
  const chosen = row.versions.find((version) => version.id === chosenId) ?? newest;
  if (!chosen) {
    return null;
  }

  return (
    <TableRow className="relative hover:bg-accent">
      {/* Takes the width the other columns leave; min-w wins over max-w-0 on narrow screens. */}
      <TableCell className="w-full max-w-0 min-w-65 whitespace-normal">
        {/* The one link of the row; its ::after covers the whole row. */}
        <a
          href={chosen.open}
          target="_blank"
          rel="noopener"
          aria-label={t.open(row.title, row.withVersions ? chosen.name : null)}
          className={stretchedRowLinkClass}
        >
          <span className="block text-sm font-semibold">{row.title}</span>
          <span className={cn(muted, "truncate text-[13px]")}>{chosen.fileName}</span>
          <span className={cn(muted, "text-xs")}>
            {t.fileSummary(t.format[chosen.format], formatFileSize(chosen.sizeBytes))}
          </span>
        </a>
      </TableCell>
      <TableCell>
        <TypeTag type={row.type} />
      </TableCell>
      <TableCell>{row.language && t.language[row.language]}</TableCell>
      <TableCell>
        <div className={cn(aboveRowLinkClass, "flex items-center gap-2")}>
          {row.withVersions ? (
            <NativeSelect
              aria-label={t.versions.select(row.title)}
              value={chosen.id}
              onChange={(event) => setChosenId(event.target.value)}
              className={cn(
                versionSelectWidth,
                "[&>select]:h-7.5 [&>select]:font-mono [&>select]:text-[13px]",
              )}
            >
              {row.versions.map((version) => (
                <NativeSelectOption key={version.id} value={version.id}>
                  {version.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          ) : (
            <span aria-hidden className={versionSelectWidth} />
          )}
          <AddVersionDialog title={row.title} addVersion={actions.addVersion} />
        </div>
      </TableCell>
      <TableCell>
        <time dateTime={isoDay(chosen.uploadedAt, timeZone)} className="font-mono text-[13px]">
          {formatDay(chosen.uploadedAt, timeZone)}
        </time>
      </TableCell>
      <TableCell>
        <div className={aboveRowLinkClass}>
          <DocumentRowActions
            title={row.title}
            downloadHref={chosen.download}
            versionCount={row.withVersions ? row.versions.length : null}
            actions={actions}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}
