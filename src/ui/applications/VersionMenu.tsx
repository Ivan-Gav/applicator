"use client";

import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { useCallback, useId, useState } from "react";
import { createPortal } from "react-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuTrigger,
} from "@/ui/kit/dropdown-menu";
import { messages } from "@/ui/messages";
import type { AttachableVersion } from "./attachable-documents";

export type VersionMenuProps = {
  title: string;
  /** Newest first. */
  versions: readonly AttachableVersion[];
  sentId: string;
  onPick: (versionId: string) => void;
};

const t = messages.applications.form.documents;

/** The version sent, as a quiet button opening a menu of every version, newest first. */
export function VersionMenu({ title, versions, sentId, onPick }: VersionMenuProps) {
  const [open, setOpen] = useState(false);
  const menuTitleId = useId();
  // Portalled into the page's <main>, not <body>, so the menu stays inside a landmark.
  const [menuContainer, setMenuContainer] = useState<HTMLElement | null>(null);
  const findMenuContainer = useCallback((trigger: HTMLElement | null) => {
    setMenuContainer(trigger?.closest("main") ?? null);
  }, []);
  const sent = versions.find((version) => version.id === sentId);

  return (
    <>
      {/* Not modal, as the status menu: the shield below blocks the page instead. */}
      <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            ref={findMenuContainer}
            type="button"
            aria-label={t.version(title)}
            className="-ml-1.25 inline-flex max-w-42.5 items-center gap-1.25 rounded-[3px] px-1.25 py-0.75 font-mono text-[13px] text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="truncate">{sent?.name}</span>
            <svg
              aria-hidden
              focusable="false"
              width="8"
              height="8"
              viewBox="0 0 8 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="shrink-0"
            >
              <path d="M1 2.5l3 3 3-3" />
            </svg>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          container={menuContainer}
          onPointerDownOutside={(event) => event.preventDefault()}
          className="w-auto min-w-65"
        >
          <DropdownMenuRadioGroup
            aria-labelledby={menuTitleId}
            value={sentId}
            onValueChange={onPick}
          >
            <DropdownMenuLabel id={menuTitleId}>{t.versionMenuTitle}</DropdownMenuLabel>
            {versions.map((version) => (
              <DropdownMenuPrimitive.RadioItem
                key={version.id}
                value={version.id}
                className="flex h-8.5 cursor-default items-center justify-between gap-2.5 rounded-md px-2.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:ring-2 focus:ring-ring focus:ring-inset"
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  <span aria-hidden className="w-3 shrink-0">
                    <DropdownMenuPrimitive.ItemIndicator>✓</DropdownMenuPrimitive.ItemIndicator>
                  </span>
                  <span className="truncate font-mono">{version.name}</span>
                </span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {version.uploadedOn}
                </span>
              </DropdownMenuPrimitive.RadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {open &&
        menuContainer &&
        createPortal(
          // A click outside the open menu only closes it; Escape does the same from the keyboard.
          <div aria-hidden className="fixed inset-0 z-40" onClick={() => setOpen(false)} />,
          menuContainer,
        )}
    </>
  );
}
