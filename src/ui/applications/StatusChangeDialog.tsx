"use client";

import { type FormEvent, useId, useState, useTransition } from "react";
import type {
  Application,
  ApplicationStatus,
  StatusChangeFailure,
} from "@/domain/application/model";
import { nextStatuses } from "@/domain/application/rules";
import type { StatusChange } from "@/domain/application/schema";
import { awaitingHydrationClass, useHydrated } from "@/ui/hooks/use-hydrated";
import { Alert, AlertDescription } from "@/ui/kit/alert";
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
import { Field, FieldLabel } from "@/ui/kit/field";
import { NativeSelect, NativeSelectOption } from "@/ui/kit/native-select";
import { messages } from "@/ui/messages";

export type ChangeStatus = (
  id: string,
  change: StatusChange,
) => Promise<StatusChangeFailure | null>;

export type StatusChangeDialogProps = {
  application: Application;
  changeStatus: ChangeStatus;
};

const t = messages.applications.statusChange;

/** Offers only the moves the domain allows; nothing at all from a final status. */
export function StatusChangeDialog({ application, changeStatus }: StatusChangeDialogProps) {
  const options = nextStatuses(application.status);
  const name = messages.applications.name(application);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ApplicationStatus | undefined>(options[0]);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const hydrated = useHydrated();
  const id = useId();

  if (options.length === 0) {
    return null;
  }

  function onOpenChange(next: boolean) {
    if (next) {
      setStatus(options[0]);
      setFailure(null);
    }
    setOpen(next);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === undefined) {
      return;
    }
    setFailure(null);
    startSaving(async () => {
      try {
        const refused = await changeStatus(application.id, { status });
        if (refused === null) {
          setOpen(false);
        } else {
          setFailure(t.failure[refused]);
        }
      } catch {
        setFailure(t.failed);
      }
    });
  }

  const statusId = `${id}-status`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={!hydrated}
          className={hydrated ? undefined : awaitingHydrationClass}
          aria-label={messages.applications.actions.label(t.title, name)}
        >
          {t.title}
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t.title}</DialogTitle>
            <DialogDescription>
              {t.description(name, messages.applications.status[application.status])}
            </DialogDescription>
          </DialogHeader>

          <Field>
            <FieldLabel htmlFor={statusId}>{t.status}</FieldLabel>
            <NativeSelect
              id={statusId}
              className="w-full"
              value={status}
              onChange={(event) => setStatus(event.target.value as ApplicationStatus)}
            >
              {options.map((option) => (
                <NativeSelectOption key={option} value={option}>
                  {messages.applications.status[option]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          {failure && (
            <Alert variant="destructive">
              <AlertDescription>
                <p className="text-foreground">{failure}</p>
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t.cancel}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? t.saving : t.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
