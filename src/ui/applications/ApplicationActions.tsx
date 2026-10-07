"use client";

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
import { IconTooltip } from "@/ui/IconTooltip";
import { ArchiveIcon } from "@/ui/icons/ArchiveIcon";
import { DeleteIcon } from "@/ui/icons/DeleteIcon";
import { RestoreIcon } from "@/ui/icons/RestoreIcon";
import { Button } from "@/ui/kit/button";
import { cn } from "@/lib/utils";
import { messages } from "@/ui/messages";

export type ApplicationActionHandlers = {
  archive: (id: string) => Promise<void>;
  unarchive: (id: string) => Promise<void>;
  delete: (id: string) => Promise<void>;
};

export type ApplicationActionsProps = {
  application: Application;
  actions: ApplicationActionHandlers;
};

const t = messages.applications.actions;
const d = messages.applications.deleteDialog;
const iconButton =
  "rounded-full text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted";

export function ApplicationActions({ application, actions }: ApplicationActionsProps) {
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
      <div className="flex items-center gap-1">
        <IconTooltip label={archiveLabel}>
          <Button
            variant="ghost"
            size="icon"
            disabled={archiving || !hydrated}
            className={cn(iconButton, !hydrated && awaitingHydrationClass)}
            aria-label={t.label(archiveLabel, name)}
            onClick={toggleArchived}
          >
            {archived ? <RestoreIcon className="size-5" /> : <ArchiveIcon className="size-5" />}
          </Button>
        </IconTooltip>
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <IconTooltip label={t.delete}>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={!hydrated}
                className={cn(
                  iconButton,
                  "hover:text-destructive",
                  !hydrated && awaitingHydrationClass,
                )}
                aria-label={t.label(t.delete, name)}
              >
                <DeleteIcon className="size-5" />
              </Button>
            </AlertDialogTrigger>
          </IconTooltip>
          <AlertDialogContent
            // A click outside cancels, as Cancel does, unless the deletion is under way.
            onOverlayClick={() => {
              if (!deleting) {
                setConfirmOpen(false);
              }
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>{d.title}</AlertDialogTitle>
              <AlertDialogDescription>{d.description(name)}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{d.cancel}</AlertDialogCancel>
              <Button variant="destructive" disabled={deleting} onClick={confirmDelete}>
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
