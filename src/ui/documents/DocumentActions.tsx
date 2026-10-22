"use client";

import { type FormEvent, useId, useState, useTransition } from "react";
import type { DocumentUploadOutcome } from "@/domain/document/model";
import { documentFormField, documentTitleSchema } from "@/domain/document/schema";
import { cn } from "@/lib/utils";
import { awaitingHydrationClass, useHydrated } from "@/ui/hooks/use-hydrated";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/ui/kit/alert-dialog";
import { Button } from "@/ui/kit/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui/kit/dialog";
import { Field, FieldError, FieldLabel } from "@/ui/kit/field";
import { Input } from "@/ui/kit/input";
import { destructiveIconButtonClass, iconButtonClass } from "@/ui/icon-button";
import { IconTooltip } from "@/ui/IconTooltip";
import { DeleteIcon } from "@/ui/icons/DeleteIcon";
import { DownloadIcon } from "@/ui/icons/DownloadIcon";
import { RenameIcon } from "@/ui/icons/RenameIcon";
import { VersionAddIcon } from "@/ui/icons/VersionAddIcon";
import { messages } from "@/ui/messages";
import { UploadForm } from "./UploadForm";

/** The actions on one document, bound to it. */
export type DocumentActionHandlers = {
  addVersion: (form: FormData) => Promise<DocumentUploadOutcome>;
  /** Whether the title was taken. */
  rename: (title: string) => Promise<boolean>;
  delete: () => Promise<void>;
};

export type DocumentRowActionsProps = {
  title: string;
  /** Where the chosen version is saved from. */
  downloadHref: string;
  /** How many versions go with the document, for the confirmation; null when it has none to tell apart. */
  versionCount: number | null;
  actions: Pick<DocumentActionHandlers, "rename" | "delete">;
};

const t = messages.documents;
const iconSize = "size-5";

/** Download, rename and delete, as icon buttons. */
export function DocumentRowActions({
  title,
  downloadHref,
  versionCount,
  actions,
}: DocumentRowActionsProps) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <IconTooltip label={t.actions.download}>
          <Button asChild variant="ghost" size="icon" className={iconButtonClass}>
            <a href={downloadHref} aria-label={t.actions.label(t.actions.download, title)}>
              <DownloadIcon className={iconSize} />
            </a>
          </Button>
        </IconTooltip>
        <RenameDialog title={title} rename={actions.rename} />
        <DeleteDialog
          title={title}
          versionCount={versionCount}
          remove={actions.delete}
          onFailure={() => setFailed(true)}
        />
      </div>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {t.actions.failed}
        </p>
      )}
    </div>
  );
}

/** An icon trigger's props: disabled until hydration, which its handler needs, yet keeping its look. */
function useIconTrigger(className = iconButtonClass) {
  const hydrated = useHydrated();
  return { disabled: !hydrated, className: cn(className, !hydrated && awaitingHydrationClass) };
}

/** Adds a version through the upload form, as an icon button. */
export function AddVersionDialog({
  title,
  addVersion,
}: {
  title: string;
  addVersion: DocumentActionHandlers["addVersion"];
}) {
  const [open, setOpen] = useState(false);
  const trigger = useIconTrigger();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <IconTooltip label={t.actions.addVersion}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t.actions.label(t.actions.addVersion, title)}
            {...trigger}
          >
            <VersionAddIcon className={iconSize} />
          </Button>
        </DialogTrigger>
      </IconTooltip>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.versionDialog.title(title)}</DialogTitle>
          <DialogDescription>{t.versionDialog.description}</DialogDescription>
        </DialogHeader>
        <UploadForm submit={addVersion} onStored={() => setOpen(false)} withDetails={false} />
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({
  title,
  rename,
}: {
  title: string;
  rename: DocumentActionHandlers["rename"];
}) {
  const id = useId();
  const trigger = useIconTrigger();
  const [open, setOpen] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [saving, startSaving] = useTransition();

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const entered = documentTitleSchema.safeParse(
      new FormData(event.currentTarget).get(documentFormField.title),
    );
    if (!entered.success) {
      setRejected(true);
      return;
    }
    startSaving(async () => {
      try {
        const renamed = await rename(entered.data);
        setRejected(!renamed);
        if (renamed) {
          setOpen(false);
        }
      } catch {
        setRejected(true);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setRejected(false);
      }}
    >
      <IconTooltip label={t.actions.rename}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t.actions.label(t.actions.rename, title)}
            {...trigger}
          >
            <RenameIcon className={iconSize} />
          </Button>
        </DialogTrigger>
      </IconTooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.renameDialog.title}</DialogTitle>
        </DialogHeader>
        <form noValidate onSubmit={save} className="flex flex-col gap-4">
          <Field data-invalid={rejected}>
            <FieldLabel htmlFor={`${id}-title`}>{t.form.title}</FieldLabel>
            <Input
              id={`${id}-title`}
              name={documentFormField.title}
              defaultValue={title}
              maxLength={200}
              aria-invalid={rejected}
              aria-describedby={rejected ? `${id}-error` : undefined}
            />
            {rejected && <FieldError id={`${id}-error`}>{t.renameDialog.rejected}</FieldError>}
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                {t.renameDialog.cancel}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? t.renameDialog.saving : t.renameDialog.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  title,
  versionCount,
  remove,
  onFailure,
}: {
  title: string;
  versionCount: number | null;
  remove: DocumentActionHandlers["delete"];
  onFailure: () => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useIconTrigger(destructiveIconButtonClass);
  const [deleting, startDeleting] = useTransition();

  // The dialog stays open until the deletion settles.
  function confirm() {
    startDeleting(async () => {
      try {
        await remove();
      } catch {
        onFailure();
      }
      setOpen(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <IconTooltip label={t.actions.delete}>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t.actions.label(t.actions.delete, title)}
            {...trigger}
          >
            <DeleteIcon className={iconSize} />
          </Button>
        </AlertDialogTrigger>
      </IconTooltip>
      <AlertDialogContent
        // A click outside cancels, as Cancel does, unless the deletion is under way.
        onOverlayClick={() => {
          if (!deleting) {
            setOpen(false);
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{t.deleteDialog.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {t.deleteDialog.description(title, versionCount)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t.deleteDialog.cancel}</AlertDialogCancel>
          <Button variant="destructive" disabled={deleting} onClick={confirm}>
            {deleting ? t.deleteDialog.deleting : t.deleteDialog.confirm}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
