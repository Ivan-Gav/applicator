"use client";

import { useState } from "react";
import type { DocumentUploadOutcome } from "@/domain/document/model";
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
import { cn } from "@/lib/utils";
import { messages } from "@/ui/messages";
import { UploadForm } from "./UploadForm";

export type UploadDocumentDialogProps = {
  upload: (form: FormData) => Promise<DocumentUploadOutcome>;
};

const t = messages.documents;

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.uploadDialog.title}</DialogTitle>
          <DialogDescription>{t.uploadDialog.description}</DialogDescription>
        </DialogHeader>
        <UploadForm submit={upload} onStored={() => setOpen(false)} withDetails />
      </DialogContent>
    </Dialog>
  );
}
