import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { messages } from "@/ui/messages";
import { AppHeader } from "./AppHeader";

vi.mock("next/navigation", () => ({ usePathname: () => "/list" }));

function showHeader() {
  render(
    <AppHeader
      homeHref="/list"
      navItems={[{ href: "/list", label: messages.nav.applications }]}
      email="jane@example.com"
      signOut={vi.fn()}
    />,
  );
  return screen.getByRole("banner");
}

describe("AppHeader", () => {
  it("names the app, the signed-in user and the current section", () => {
    const header = showHeader();

    expect(within(header).getByRole("link", { name: messages.app.name })).toHaveAttribute(
      "href",
      "/list",
    );
    expect(header).toHaveTextContent("jane@example.com");
    expect(
      within(within(header).getByRole("navigation", { name: messages.nav.label })).getByRole(
        "link",
        { name: messages.nav.applications },
      ),
    ).toHaveAttribute("aria-current", "page");
  });

  it("offers sign-out and the theme by name, though both show only an icon", () => {
    const header = showHeader();

    expect(within(header).getByRole("button", { name: messages.nav.signOut })).toHaveAttribute(
      "type",
      "submit",
    );
    expect(within(header).getByRole("switch", { name: messages.nav.darkTheme })).toBeVisible();
  });
});
