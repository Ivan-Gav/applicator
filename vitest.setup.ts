import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// RTL only auto-cleans between tests when `afterEach` is a global; globals stay off here.
afterEach(cleanup);

// jsdom has no ResizeObserver; Radix measures popper content (tooltips, menus) with one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
