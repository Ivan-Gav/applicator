"use client";

import { Button } from "@/ui/kit/button";
import { messages } from "@/ui/messages";

export type LeaveEmptyButtonProps = {
  /** The label of the field it concerns, which tells the buttons of a form apart. */
  field: string;
  onClick: () => void;
};

const t = messages.applications.form.paste;

/** Accepts a field marked for a rejected pasted value as it is, empty. */
export function LeaveEmptyButton({ field, onClick }: LeaveEmptyButtonProps) {
  return (
    <Button
      type="button"
      variant="link"
      size="xs"
      className="h-auto self-start px-0 text-[13px]"
      aria-label={t.leaveEmptyLabel(field)}
      onClick={onClick}
    >
      {t.leaveEmpty}
    </Button>
  );
}
