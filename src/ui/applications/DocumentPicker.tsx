"use client";

import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { isAttached } from "@/domain/application/attachments";
import type { AttachedVersion } from "@/domain/application/model";
import { isOfferedForAttaching } from "@/domain/document/list";
import { type DocumentType, documentTypes } from "@/domain/document/model";
import { cn } from "@/lib/utils";
import { SearchIcon } from "@/ui/icons/SearchIcon";
import { UploadCircleIcon } from "@/ui/icons/UploadCircleIcon";
import { Button } from "@/ui/kit/button";
import { Input } from "@/ui/kit/input";
import { NativeSelect, NativeSelectOption } from "@/ui/kit/native-select";
import { messages } from "@/ui/messages";
import { TypeTag } from "@/ui/documents/TypeTag";
import type { AttachableDocument } from "./attachable-documents";

export type DocumentPickerProps = {
  /** Newest upload first, as the list shows them. */
  documents: readonly AttachableDocument[];
  attached: readonly AttachedVersion[];
  onAdd: (document: AttachableDocument) => void;
  /** Opens the upload modal; the field takes focus again when it closes. */
  onUpload: () => void;
  /** Called with the field, to give it focus back. */
  inputRef?: (input: HTMLInputElement | null) => void;
};

const t = messages.applications.form.documents;

// The upload item ends the list of options the arrow keys move through.
const uploadItem = "upload";

/**
 * A type select, a search field listing the documents to attach, and Add.
 * The type only narrows the list; a document already attached is listed but
 * cannot be chosen.
 */
export function DocumentPicker({
  documents,
  attached,
  onAdd,
  onUpload,
  inputRef,
}: DocumentPickerProps) {
  const listId = useId();
  const input = useRef<HTMLInputElement | null>(null);
  const [type, setType] = useState<DocumentType | null>(null);
  const [text, setText] = useState("");
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const chosen = documents.find((document) => document.id === chosenId) ?? null;
  // A chosen document's title in the field searches nothing: the whole list shows.
  const search = chosen !== null && text === chosen.title ? "" : text;
  const offered = documents.filter((document) => isOfferedForAttaching(document, type, search));
  const choosable = [
    ...offered
      .filter((document) => !isAttached(attached, document.id))
      .map((document) => document.id),
    uploadItem,
  ];
  // Only the arrow keys make an option active; one that leaves the list stops being so.
  const active = activeId !== null && choosable.includes(activeId) ? activeId : null;
  const optionId = (id: string) => `${listId}-${id}`;

  // After rendering: a list opened by the same key press is still hidden in the handler.
  useEffect(() => {
    if (open && active !== null) {
      document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: "nearest" });
    }
  }, [open, active, listId]);

  function close() {
    setOpen(false);
    setActiveId(null);
  }

  function choose(document: AttachableDocument) {
    setChosenId(document.id);
    setText(document.title);
    close();
  }

  function add() {
    if (chosen === null || isAttached(attached, chosen.id)) {
      return;
    }
    onAdd(chosen);
    setChosenId(null);
    setText("");
    close();
    input.current?.focus();
  }

  function upload() {
    close();
    onUpload();
  }

  function pick(id: string) {
    const document = documents.find((candidate) => candidate.id === id);
    if (id === uploadItem) {
      upload();
    } else if (document) {
      choose(document);
    }
  }

  function changeType(value: string) {
    const next = documentTypes.find((candidate) => candidate === value) ?? null;
    setType(next);
    if (chosen !== null && next !== null && chosen.type !== next) {
      setChosenId(null);
      setText("");
    }
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const index = active === null ? -1 : choosable.indexOf(active);
      const next =
        event.key === "ArrowDown" ? index + 1 : index === -1 ? choosable.length - 1 : index - 1;
      setActiveId(choosable[Math.min(Math.max(next, 0), choosable.length - 1)] ?? null);
    } else if (event.key === "Enter") {
      // Chooses or adds instead of submitting the application form.
      event.preventDefault();
      if (open && active !== null) {
        pick(active);
      } else {
        add();
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      if (open) {
        close();
      } else {
        setChosenId(null);
        setText("");
      }
    }
  }

  return (
    <div role="group" aria-label={t.addGroup} className="flex flex-wrap items-start gap-2">
      <NativeSelect
        aria-label={t.type}
        value={type ?? ""}
        onChange={(event) => changeType(event.target.value)}
        className={cn("w-44 shrink-0", type === null && "[&>select]:text-muted-foreground")}
      >
        <NativeSelectOption value="">{t.anyType}</NativeSelectOption>
        {documentTypes.map((documentType) => (
          <NativeSelectOption key={documentType} value={documentType}>
            {messages.documents.type[documentType]}
          </NativeSelectOption>
        ))}
      </NativeSelect>

      <div className="relative min-w-0 flex-[1_1_240px]">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.75 size-3.75 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={(element) => {
            input.current = element;
            inputRef?.(element);
          }}
          role="combobox"
          aria-label={t.document}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && active !== null ? optionId(active) : undefined}
          autoComplete="off"
          value={text}
          placeholder={t.placeholder[type ?? "any"]}
          className="h-9 rounded-[3px] bg-card pr-3 pl-8.5 text-sm md:text-sm dark:bg-card"
          onChange={(event) => {
            setText(event.target.value);
            setChosenId(null);
            setOpen(true);
            setActiveId(null);
          }}
          onClick={() => (open ? close() : setOpen(true))}
          onKeyDown={keyDown}
          onBlur={close}
        />
        <div
          hidden={!open}
          className="absolute inset-x-0 top-[calc(100%+4px)] z-20 flex flex-col overflow-hidden rounded-[4px] border bg-popover text-sm text-popover-foreground shadow-md"
        >
          {offered.length === 0 && (
            <p className="px-3 py-3 text-muted-foreground">
              {search.trim() === "" ? t.noDocuments : t.nothingMatches(search)}
            </p>
          )}
          <div id={listId} role="listbox" aria-label={t.options}>
            <div className={cn("max-h-85 overflow-y-auto", offered.length > 0 && "py-1")}>
              {offered.map((document) => {
                const taken = isAttached(attached, document.id);
                return (
                  // The field keeps focus and the keyboard; a click only chooses.
                  // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                  <div
                    key={document.id}
                    id={optionId(document.id)}
                    role="option"
                    tabIndex={-1}
                    aria-selected={document.id === active}
                    aria-disabled={taken ? true : undefined}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      if (!taken) {
                        choose(document);
                      }
                    }}
                    className={cn(
                      "grid h-8.5 cursor-default grid-cols-[120px_minmax(0,1fr)_auto] items-center gap-x-3 px-3",
                      taken ? "opacity-45" : "hover:bg-accent",
                      document.id === active && "bg-accent shadow-[inset_3px_0_0_var(--ring)]",
                    )}
                  >
                    <TypeTag type={document.type} compact />
                    <span className="truncate">{document.title}</span>
                    <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                      {taken ? t.attached : document.uploadedOn}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
            <div
              id={optionId(uploadItem)}
              role="option"
              tabIndex={-1}
              aria-selected={active === uploadItem}
              onMouseDown={(event) => event.preventDefault()}
              onClick={upload}
              className={cn(
                "flex h-10 cursor-default items-center gap-2.25 border-t px-3 font-semibold hover:bg-accent",
                active === uploadItem && "bg-accent shadow-[inset_3px_0_0_var(--ring)]",
              )}
            >
              <UploadCircleIcon className="size-4.5" />
              <span>{t.uploadAndAttach}</span>
            </div>
          </div>
        </div>
      </div>

      <Button
        type="button"
        size="lg"
        disabled={chosen === null}
        onClick={add}
        className="rounded-[3px] px-3.5 font-semibold"
      >
        {t.add}
      </Button>
    </div>
  );
}
