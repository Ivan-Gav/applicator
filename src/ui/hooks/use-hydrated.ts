import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * For a control disabled only until hydration: it keeps its normal look, so
 * nothing fades in when it becomes usable.
 */
export const awaitingHydrationClass = "disabled:opacity-100";

/**
 * False in the server render and until hydration, true after. Controls whose
 * work is done by an event handler stay disabled until then, as a click before
 * hydration would be lost or fall through to the browser's default.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
