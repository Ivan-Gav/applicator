"use client";

import type { ReactElement } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/kit/tooltip";

export type IconTooltipProps = {
  /** Usually the short form of the control's accessible name, e.g. "Archive". */
  label: string;
  /** One control; the tooltip shows on its hover and keyboard focus. */
  children: ReactElement;
};

/** Names an icon-only control for sighted users; screen readers already have its aria-label. */
export function IconTooltip({ label, children }: IconTooltipProps) {
  return (
    // Its own provider, so the control needs nothing from the tree above it.
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
