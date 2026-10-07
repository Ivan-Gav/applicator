import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { MainNav } from "./MainNav";

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));

const items = [{ href: "/list", label: "Applications" }];

function renderAt(pathname: string) {
  vi.mocked(usePathname).mockReturnValue(pathname);
  render(<MainNav items={items} />);
  return screen.getByRole("link", { name: "Applications" });
}

describe("MainNav", () => {
  it.each(["/list", "/list/00000000-0000-4000-8000-0000000000a1", "/list/new"])(
    "marks the item current at %s",
    (pathname) => {
      expect(renderAt(pathname)).toHaveAttribute("aria-current", "page");
    },
  );

  it.each(["/", "/listing"])("leaves the item unmarked at %s", (pathname) => {
    expect(renderAt(pathname)).not.toHaveAttribute("aria-current");
  });

  it("links each item to its page", () => {
    expect(renderAt("/")).toHaveAttribute("href", "/list");
  });
});
