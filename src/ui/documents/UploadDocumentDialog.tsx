"use client";

import { useState } from "react";
import type { NewDocumentOutcome } from "@/domain/document/model";
import { cn } from "@/lib/utils";
import { awaitingHydrationClass, useHydrated } from "@/ui/hooks/use-hydrated";
import { Button } from "@/ui/kit/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui/kit/dialog";
import { messages } from "@/ui/messages";
import { UploadForm } from "./UploadForm";

/** Stores a new document; resolves with its id, or with why the upload was refused. */
export type UploadDocument = (form: FormData) => Promise<NewDocumentOutcome>;

export type UploadDocumentDialogProps = {
  upload: UploadDocument;
};

export type UploadDocumentModalProps = {
  upload: UploadDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new document's id once it is stored, before the modal closes. */
  onUploaded?: (documentId: string) => void;
  /** Takes focus when the modal closes, which by default returns it to the trigger. */
  onCloseAutoFocus?: (event: Event) => void;
};

const t = messages.documents;

function UploadContent({
  upload,
  onStored,
  onCloseAutoFocus,
}: {
  upload: UploadDocument;
  onStored: (documentId: string) => void;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  return (
    <DialogContent className="sm:max-w-md" onCloseAutoFocus={onCloseAutoFocus}>
      <DialogHeader>
        <DialogTitle>{t.uploadDialog.title}</DialogTitle>
        <DialogDescription>{t.uploadDialog.description}</DialogDescription>
      </DialogHeader>
      <UploadForm
        submit={upload}
        onStored={(outcome) => {
          if (outcome.failure === null) {
            onStored(outcome.documentId);
          }
        }}
        withDetails
      />
    </DialogContent>
  );
}

/** The upload form in a modal, opened by whoever renders it. */
export function UploadDocumentModal({
  upload,
  open,
  onOpenChange,
  onUploaded,
  onCloseAutoFocus,
}: UploadDocumentModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <UploadContent
        upload={upload}
        onStored={(documentId) => {
          onUploaded?.(documentId);
          onOpenChange(false);
        }}
        onCloseAutoFocus={onCloseAutoFocus}
      />
    </Dialog>
  );
}

/** Starts a new document from its first file. */
export function UploadDocumentDialog({ upload }: UploadDocumentDialogProps) {
  const [open, setOpen] = useState(false);
  const hydrated = useHydrated();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="lg"
          disabled={!hydrated}
          className={cn("rounded-[3px] px-3.5 font-semibold", !hydrated && awaitingHydrationClass)}
        >
          {t.upload}
        </Button>
      </DialogTrigger>
      <UploadContent upload={upload} onStored={() => setOpen(false)} />
    </Dialog>
  );
}
