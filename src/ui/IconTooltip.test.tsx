import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IconTooltip } from "./IconTooltip";

// jsdom has no ResizeObserver; Radix measures the tooltip's arrow with one.
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderButton() {
  render(
    <IconTooltip label="Archive">
      <button type="button" aria-label="Archive: Engineer at Acme" />
    </IconTooltip>,
  );
  return { button: screen.getByRole("button"), user: userEvent.setup() };
}

describe("IconTooltip", () => {
  it("shows nothing until asked", () => {
    renderButton();

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("names the control on hover", async () => {
    const { button, user } = renderButton();

    await user.hover(button);

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Archive");
  });

  it("names the control on keyboard focus", async () => {
    const { user } = renderButton();

    await user.tab();

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Archive");
  });
});
