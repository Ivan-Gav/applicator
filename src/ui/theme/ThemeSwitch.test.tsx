import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messages } from "@/ui/messages";
import { ThemeProvider } from "./ThemeProvider";
import { ThemeSwitch } from "./ThemeSwitch";

function systemPrefersDark(dark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: dark,
      media: query,
      // next-themes subscribes through the deprecated pair.
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
}

function renderSwitch() {
  render(
    <ThemeProvider>
      <ThemeSwitch />
    </ThemeProvider>,
  );
  return {
    switch: screen.getByRole("switch", { name: messages.nav.darkTheme }),
    user: userEvent.setup(),
  };
}

beforeEach(() => {
  systemPrefersDark(false);
});

afterEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  vi.unstubAllGlobals();
});

describe("ThemeSwitch", () => {
  it("follows the system until the user picks", () => {
    systemPrefersDark(true);

    const { switch: toggle } = renderSwitch();

    expect(toggle).toBeChecked();
    expect(document.documentElement).toHaveClass("dark");
  });

  it("turns the dark theme on and off", async () => {
    const { switch: toggle, user } = renderSwitch();
    expect(toggle).not.toBeChecked();

    await user.click(toggle);

    expect(toggle).toBeChecked();
    expect(document.documentElement).toHaveClass("dark");

    await user.click(toggle);

    expect(toggle).not.toBeChecked();
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("stays disabled until hydration, as a click then would be lost", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(
      <ThemeProvider>
        <ThemeSwitch />
      </ThemeProvider>,
    );

    expect(within(container).getByRole("switch")).toBeDisabled();
  });
});
