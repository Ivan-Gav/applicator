"use client";

import { useId, useRef, useState } from "react";
import { withAttached, withoutDocument, withVersionSent } from "@/domain/application/attachments";
import type { AttachedVersion } from "@/domain/application/model";
import { cn } from "@/lib/utils";
import { type UploadDocument, UploadDocumentModal } from "@/ui/documents/UploadDocumentDialog";
import { TypeTag } from "@/ui/documents/TypeTag";
import { destructiveIconButtonClass } from "@/ui/icon-button";
import { DeleteIcon } from "@/ui/icons/DeleteIcon";
import { Button } from "@/ui/kit/button";
import { messages } from "@/ui/messages";
import type { AttachableDocument } from "./attachable-documents";
import { DocumentPicker } from "./DocumentPicker";
import { panel } from "./panel";
import { VersionMenu } from "./VersionMenu";

export type DocumentsPanelProps = {
  /** Every document of the user, newest upload first. */
  documents: readonly AttachableDocument[];
  attached: readonly AttachedVersion[];
  /** The list changed; nothing is stored until the form is saved. */
  onChange: (attached: readonly AttachedVersion[]) => void;
  upload: UploadDocument;
  /** A document was uploaded from here, to be attached once the page lists it. */
  onUploaded: (documentId: string) => void;
};

const t = messages.applications.form.documents;

/** The documents sent with the application, as part of its form. */
export function DocumentsPanel({
  documents,
  attached,
  onChange,
  upload,
  onUploaded,
}: DocumentsPanelProps) {
  const titleId = useId();
  const field = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const rows = attached.flatMap((attachment) => {
    const document = documents.find((candidate) => candidate.id === attachment.documentId);
    return document ? [{ attachment, document }] : [];
  });

  return (
    <div role="group" aria-labelledby={titleId} className={cn(panel, "flex flex-col gap-3 pb-4")}>
      <div className="flex items-baseline justify-between gap-3">
        <span id={titleId} className="text-sm font-semibold">
          {t.title}
        </span>
        {rows.length > 0 && (
          <span className="text-[13px] text-muted-foreground">{t.count(rows.length)}</span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.empty}</p>
      ) : (
        <ul aria-label={t.listLabel} className="border-t">
          {rows.map(({ attachment, document }) => (
            <AttachedRow
              key={document.id}
              document={document}
              sentId={attachment.versionId}
              onPick={(versionId) => onChange(withVersionSent(attached, document.id, versionId))}
              onRemove={() => onChange(withoutDocument(attached, document.id))}
            />
          ))}
        </ul>
      )}

      <DocumentPicker
        documents={documents}
        attached={attached}
        onAdd={(document) => onChange(withAttached(attached, document))}
        onUpload={() => setUploading(true)}
        inputRef={(input) => {
          field.current = input;
        }}
      />
      <UploadDocumentModal
        upload={upload}
        open={uploading}
        onOpenChange={setUploading}
        onUploaded={onUploaded}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          field.current?.focus();
        }}
      />
    </div>
  );
}

function AttachedRow({
  document,
  sentId,
  onPick,
  onRemove,
}: {
  document: AttachableDocument;
  sentId: string;
  onPick: (versionId: string) => void;
  onRemove: () => void;
}) {
  const sent = document.versions.find((version) => version.id === sentId) ?? document.versions[0];
  if (!sent) {
    return null;
  }
  const { title } = document;

  return (
    <li className="flex min-h-10.5 flex-wrap items-center gap-x-4 gap-y-1 border-b py-1.5 sm:grid sm:grid-cols-[minmax(0,1fr)_132px_170px_32px] sm:py-0">
      <a
        href={sent.open}
        target="_blank"
        rel="noopener"
        aria-label={messages.documents.open(title, document.withVersions ? sent.name : null)}
        className="w-full text-sm font-semibold wrap-anywhere underline-offset-3 hover:underline sm:w-auto"
      >
        {title}
      </a>
      <TypeTag type={document.type} />
      <div className="min-w-0 flex-1 sm:flex-none">
        {document.withVersions && (
          <VersionMenu
            title={title}
            versions={document.versions}
            sentId={sent.id}
            onPick={onPick}
          />
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t.remove(title)}
        onClick={onRemove}
        className={destructiveIconButtonClass}
      >
        <DeleteIcon className="size-5" />
      </Button>
    </li>
  );
}
