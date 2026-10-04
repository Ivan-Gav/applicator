"use client";

import { ArchiveIcon, ArchiveRestoreIcon, PencilIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { Application } from "@/domain/application/model";
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
import { awaitingHydrationClass, useHydrated } from "@/ui/hooks/use-hydrated";
import { Button } from "@/ui/kit/button";
import { cn } from "@/lib/utils";
import { messages } from "@/ui/messages";
import { type ChangeStatus, StatusChangeDialog } from "./StatusChangeDialog";

export type ApplicationActionHandlers = {
  changeStatus: ChangeStatus;
  archive: (id: string) => Promise<void>;
  unarchive: (id: string) => Promise<void>;
  delete: (id: string) => Promise<void>;
};

export type ApplicationActionsProps = {
  application: Application;
  editHref: string;
  actions: ApplicationActionHandlers;
};

const t = messages.applications.actions;
const d = messages.applications.deleteDialog;
// The destructive variant's text falls short of 4.5:1 on its own tint.
const destructiveText = "text-red-700 dark:text-red-300";

export function ApplicationActions({ application, editHref, actions }: ApplicationActionsProps) {
  const name = messages.applications.name(application);
  const archived = application.archivedAt !== null;
  const [failed, setFailed] = useState(false);
  const [archiving, startArchiving] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const hydrated = useHydrated();

  function toggleArchived() {
    setFailed(false);
    startArchiving(async () => {
      try {
        await (archived ? actions.unarchive(application.id) : actions.archive(application.id));
      } catch {
        setFailed(true);
      }
    });
  }

  // The dialog stays open until the deletion settles.
  function confirmDelete() {
    setFailed(false);
    startDeleting(async () => {
      try {
        await actions.delete(application.id);
        setConfirmOpen(false);
      } catch {
        setConfirmOpen(false);
        setFailed(true);
      }
    });
  }

  const archiveLabel = archived ? t.unarchive : t.archive;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={editHref} aria-label={t.label(t.edit, name)}>
            <PencilIcon aria-hidden />
            {t.edit}
          </Link>
        </Button>
        <StatusChangeDialog application={application} changeStatus={actions.changeStatus} />
        <Button
          variant="outline"
          size="sm"
          disabled={archiving || !hydrated}
          className={hydrated ? undefined : awaitingHydrationClass}
          aria-label={t.label(archiveLabel, name)}
          onClick={toggleArchived}
        >
          {archived ? <ArchiveRestoreIcon aria-hidden /> : <ArchiveIcon aria-hidden />}
          {archiveLabel}
        </Button>
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              disabled={!hydrated}
              className={cn("ml-2", destructiveText, !hydrated && awaitingHydrationClass)}
              aria-label={t.label(t.delete, name)}
            >
              <Trash2Icon aria-hidden />
              {t.delete}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{d.title}</AlertDialogTitle>
              <AlertDialogDescription>{d.description(name)}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{d.cancel}</AlertDialogCancel>
              <Button
                variant="destructive"
                className={destructiveText}
                disabled={deleting}
                onClick={confirmDelete}
              >
                {deleting ? d.deleting : d.confirm}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {t.failed}
        </p>
      )}
    </div>
  );
}
