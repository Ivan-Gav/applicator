"use client";

import { useTheme } from "next-themes";
import { awaitingHydrationClass, useHydrated } from "@/ui/hooks/use-hydrated";
import { IconTooltip } from "@/ui/IconTooltip";
import { MoonIcon } from "@/ui/icons/MoonIcon";
import { SunIcon } from "@/ui/icons/SunIcon";
import { cn } from "@/lib/utils";
import { messages } from "@/ui/messages";

// next-themes' own theme names.
const Theme = {
  Light: "light",
  Dark: "dark",
} as const;

/**
 * On means dark. The knob is placed by the `.dark` class rather than by state,
 * so it is already right in the server render, before the theme is known here.
 */
export function ThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const dark = hydrated && resolvedTheme === Theme.Dark;

  return (
    <IconTooltip label={messages.nav.darkTheme}>
      <button
        type="button"
        role="switch"
        aria-checked={dark}
        aria-label={messages.nav.darkTheme}
        disabled={!hydrated}
        onClick={() => setTheme(dark ? Theme.Light : Theme.Dark)}
        className={cn(
          "inline-flex h-5.5 w-10 shrink-0 items-center rounded-full border-2 border-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          !hydrated && awaitingHydrationClass,
        )}
      >
        <span className="flex size-3.75 translate-x-0.5 items-center justify-center rounded-full bg-foreground text-header transition-transform dark:translate-x-4.75">
          <SunIcon className="size-2.25 dark:hidden" />
          <MoonIcon className="hidden size-2.25 dark:block" />
        </span>
      </button>
    </IconTooltip>
  );
}
