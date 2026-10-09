"use client";

import { useCallback, useId, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import type {
  Application,
  ApplicationStatus,
  StatusChangeFailure,
} from "@/domain/application/model";
import { likelyNextStatuses, otherNextStatuses } from "@/domain/application/rules";
import type { StatusChange } from "@/domain/application/schema";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/ui/hooks/use-hydrated";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/kit/dropdown-menu";
import { messages } from "@/ui/messages";
import { StatusSwatch } from "./StatusSwatch";
import styles from "./StatusTag.module.css";

/** Resolves with `null` once stored, or with why the change was refused. */
export type ChangeStatus = (
  id: string,
  change: StatusChange,
) => Promise<StatusChangeFailure | null>;

export const StatusTagSize = {
  List: "list",
  Page: "page",
} as const;
export type StatusTagSize = (typeof StatusTagSize)[keyof typeof StatusTagSize];

export type StatusTagProps = {
  application: Application;
  changeStatus: ChangeStatus;
  size?: StatusTagSize;
};

const t = messages.applications;
const s = t.statusChange;

/**
 * The status, and the control that changes it: a menu of every other status,
 * the likely next ones first, applied at once.
 */
export function StatusTag({
  application,
  changeStatus,
  size = StatusTagSize.List,
}: StatusTagProps) {
  const { status } = application;
  const label = t.status[status];
  const likely = likelyNextStatuses(status);
  const others = otherNextStatuses(status);
  const [open, setOpen] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const hydrated = useHydrated();
  const menuTitleId = useId();
  // Portalled into the page's <main>, not <body>, so the menu stays inside a landmark.
  const [menuContainer, setMenuContainer] = useState<HTMLElement | null>(null);
  const findMenuContainer = useCallback((trigger: HTMLElement | null) => {
    setMenuContainer(trigger?.closest("main") ?? null);
  }, []);
  const tagClass = cn(styles.tag, size === StatusTagSize.Page && styles.page);

  function move(to: ApplicationStatus) {
    setFailure(null);
    startSaving(async () => {
      try {
        const refused = await changeStatus(application.id, { status: to });
        if (refused !== null) {
          setFailure(s.failure[refused]);
        }
      } catch {
        setFailure(s.failed);
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {/* Not modal: a modal menu aria-hides the rest of the page while it stays
          focusable. The shield below blocks the page instead. */}
      <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            ref={findMenuContainer}
            type="button"
            data-status={status}
            className={tagClass}
            disabled={saving || !hydrated}
            aria-label={s.trigger(label, t.name(application))}
          >
            <span>{label}</span>
            <svg
              aria-hidden
              focusable="false"
              width="8"
              height="8"
              viewBox="0 0 8 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="shrink-0 opacity-80"
            >
              <path d="M1 2.5l3 3 3-3" />
            </svg>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          container={menuContainer}
          // The shield closes the menu on its click; closing on pointerdown would
          // remove it before the click, which would land on the page behind.
          onPointerDownOutside={(event) => event.preventDefault()}
          className="w-auto min-w-44"
        >
          <DropdownMenuGroup aria-labelledby={menuTitleId}>
            <DropdownMenuLabel id={menuTitleId}>{s.menuTitle}</DropdownMenuLabel>
            {likely.map((to) => (
              <DropdownMenuItem key={to} onSelect={() => move(to)}>
                <StatusSwatch status={to} />
                {to === status ? s.again(t.status[to]) : t.status[to]}
              </DropdownMenuItem>
            ))}
            {likely.length > 0 && <DropdownMenuSeparator />}
            {others.map((to) => (
              <DropdownMenuItem key={to} onSelect={() => move(to)}>
                <StatusSwatch status={to} />
                {t.status[to]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {open &&
        menuContainer &&
        createPortal(
          // A click outside the open menu only closes it; Escape does the same from the keyboard.
          <div aria-hidden className="fixed inset-0 z-40" onClick={() => setOpen(false)} />,
          menuContainer,
        )}
      {failure && (
        <p role="alert" className="text-xs text-destructive">
          {failure}
        </p>
      )}
    </div>
  );
}
